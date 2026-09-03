using System.Text.Json.Serialization;
using Chillax.Loyalty.API.IntegrationEvents.Events;
using Chillax.Loyalty.API.IntegrationEvents.EventHandling;

namespace Chillax.Loyalty.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddDefaultAuthentication();

        // Avoid loading full database config and migrations if startup
        // is being invoked from build-time OpenAPI generation
        if (builder.Environment.IsBuild())
        {
            builder.Services.AddDbContext<LoyaltyContext>();
            return;
        }

        builder.AddNpgsqlDbContext<LoyaltyContext>("loyaltydb");

        // REVIEW: This is done for development ease but shouldn't be here in production
        builder.Services.AddMigration<LoyaltyContext, LoyaltyContextSeed>();

        // Configure event bus for receiving order confirmation events
        builder.AddRabbitMqEventBus("eventbus")
               .ConfigureJsonOptions(options => options.TypeInfoResolverChain.Add(LoyaltyIntegrationEventContext.Default))
               .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderStatusChangedToConfirmedIntegrationEventHandler>()
               .AddSubscription<OrderCustomerAssignedIntegrationEvent, OrderCustomerAssignedIntegrationEventHandler>()
               .AddSubscription<UserProfileUpdatedIntegrationEvent, UserProfileUpdatedIntegrationEventHandler>()
               .AddSubscription<TicketRefundedIntegrationEvent, TicketRefundedIntegrationEventHandler>()
               .AddSubscription<TicketVoidedIntegrationEvent, TicketVoidedIntegrationEventHandler>();
    }
}

[JsonSerializable(typeof(UserProfileUpdatedIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToConfirmedIntegrationEvent))]
[JsonSerializable(typeof(OrderCustomerAssignedIntegrationEvent))]
[JsonSerializable(typeof(TicketVoidedIntegrationEvent))]
partial class LoyaltyIntegrationEventContext : JsonSerializerContext
{
}
