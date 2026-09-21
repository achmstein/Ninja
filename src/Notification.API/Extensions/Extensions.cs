using System.Text.Json.Serialization;
using Ninja.Notification.API.IntegrationEvents.EventHandling;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Services;

namespace Ninja.Notification.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.Services.AddServiceRequestRateLimiting();

        // Add database context
        builder.AddNpgsqlDbContext<NotificationContext>("notificationdb", configureDbContextOptions: options =>
        {
            options.UseNpgsql(builder => builder.MigrationsAssembly(typeof(NotificationContext).Assembly.FullName));
        });

        // Add database seeder
        builder.Services.AddMigration<NotificationContext, NotificationContextSeed>();

        // Add FCM service
        builder.Services.AddSingleton<IFcmService, FcmService>();

        // Add SignalR for realtime updates
        builder.Services.AddSignalR();

        // Add RabbitMQ event bus with subscriptions
        builder.AddRabbitMqEventBus("eventbus")
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(NotificationIntegrationEventContext.Default))
            .AddSubscription<PlaceBecameAvailableIntegrationEvent, PlaceBecameAvailableIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToSubmittedIntegrationEvent, OrderSubmittedIntegrationEventHandler>()
            .AddSubscription<ServiceRequestCreatedIntegrationEvent, ServiceRequestCreatedIntegrationEventHandler>()
            .AddSubscription<PlaceReservedIntegrationEvent, PlaceReservedIntegrationEventHandler>()
            .AddSubscription<ReservationCancelledIntegrationEvent, ReservationCancelledIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToCancelledIntegrationEvent, OrderCancelledIntegrationEventHandler>()
            .AddSubscription<SessionStartedIntegrationEvent, SessionStartedIntegrationEventHandler>()
            .AddSubscription<SessionEndedIntegrationEvent, SessionEndedIntegrationEventHandler>()
            .AddSubscription<SessionMemberJoinedIntegrationEvent, SessionMemberJoinedIntegrationEventHandler>()
            .AddSubscription<SessionCustomerAssignedIntegrationEvent, SessionCustomerAssignedIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderConfirmedIntegrationEventHandler>()
            .AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>()
            .AddSubscription<PlaceUpdatedIntegrationEvent, PlaceUpdatedIntegrationEventHandler>()
            .AddSubscription<OrderReminderIntegrationEvent, OrderReminderIntegrationEventHandler>()
            .AddSubscription<TicketUpdatedIntegrationEvent, TicketUpdatedIntegrationEventHandler>()
            // A bill paid, voided or refunded: the customer's own screens refetch
            .AddSubscription<OrderPaymentChangedIntegrationEvent, OrderPaymentChangedIntegrationEventHandler>()
            .AddSubscription<SessionPaidIntegrationEvent, SessionPaidIntegrationEventHandler>()
            .AddSubscription<CatalogItemAvailabilityChangedIntegrationEvent, CatalogItemAvailabilityChangedIntegrationEventHandler>()
            .AddSubscription<OrderReadyChangedIntegrationEvent, OrderReadyChangedIntegrationEventHandler>()
            .AddSubscription<StockLowIntegrationEvent, StockLowIntegrationEventHandler>()
            // A bill paid or voided ends the sitting at its place, for every phone that scanned it
            .AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>()
            .AddSubscription<TicketVoidedIntegrationEvent, TicketVoidedIntegrationEventHandler>()
            // The day's digest: the Z figures to the admin devices when the till closes
            .AddSubscription<ShiftClosedIntegrationEvent, ShiftClosedIntegrationEventHandler>();
    }
}

[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(PlaceUpdatedIntegrationEvent))]
[JsonSerializable(typeof(OrderReadyChangedIntegrationEvent))]
[JsonSerializable(typeof(PlaceBecameAvailableIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToSubmittedIntegrationEvent))]
[JsonSerializable(typeof(ServiceRequestCreatedIntegrationEvent))]
[JsonSerializable(typeof(PlaceReservedIntegrationEvent))]
[JsonSerializable(typeof(ReservationCancelledIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToCancelledIntegrationEvent))]
[JsonSerializable(typeof(SessionStartedIntegrationEvent))]
[JsonSerializable(typeof(SessionEndedIntegrationEvent))]
[JsonSerializable(typeof(SessionMemberJoinedIntegrationEvent))]
[JsonSerializable(typeof(SessionCustomerAssignedIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToConfirmedIntegrationEvent))]
[JsonSerializable(typeof(OrderReminderIntegrationEvent))]
[JsonSerializable(typeof(TicketUpdatedIntegrationEvent))]
[JsonSerializable(typeof(OrderPaymentChangedIntegrationEvent))]
[JsonSerializable(typeof(SessionPaidIntegrationEvent))]
[JsonSerializable(typeof(ShiftClosedIntegrationEvent))]
[JsonSerializable(typeof(CatalogItemAvailabilityChangedIntegrationEvent))]
[JsonSerializable(typeof(StockLowIntegrationEvent))]
public partial class NotificationIntegrationEventContext : JsonSerializerContext
{
}
