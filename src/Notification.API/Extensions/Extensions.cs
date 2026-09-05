using System.Text.Json.Serialization;
using Chillax.Notification.API.IntegrationEvents.EventHandling;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Services;

namespace Chillax.Notification.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
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
            .AddSubscription<RoomBecameAvailableIntegrationEvent, RoomBecameAvailableIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToSubmittedIntegrationEvent, OrderSubmittedIntegrationEventHandler>()
            .AddSubscription<ServiceRequestCreatedIntegrationEvent, ServiceRequestCreatedIntegrationEventHandler>()
            .AddSubscription<RoomReservedIntegrationEvent, RoomReservedIntegrationEventHandler>()
            .AddSubscription<ReservationCancelledIntegrationEvent, ReservationCancelledIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToCancelledIntegrationEvent, OrderCancelledIntegrationEventHandler>()
            .AddSubscription<SessionStartedIntegrationEvent, SessionStartedIntegrationEventHandler>()
            .AddSubscription<SessionEndedIntegrationEvent, SessionEndedIntegrationEventHandler>()
            .AddSubscription<SessionMemberJoinedIntegrationEvent, SessionMemberJoinedIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderConfirmedIntegrationEventHandler>()
            .AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>()
            .AddSubscription<OrderReminderIntegrationEvent, OrderReminderIntegrationEventHandler>()
            .AddSubscription<TicketUpdatedIntegrationEvent, TicketUpdatedIntegrationEventHandler>()
            .AddSubscription<CatalogItemAvailabilityChangedIntegrationEvent, CatalogItemAvailabilityChangedIntegrationEventHandler>()
            .AddSubscription<OrderPreparationChangedIntegrationEvent, OrderPreparationChangedIntegrationEventHandler>();
    }
}

[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(OrderPreparationChangedIntegrationEvent))]
[JsonSerializable(typeof(RoomBecameAvailableIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToSubmittedIntegrationEvent))]
[JsonSerializable(typeof(ServiceRequestCreatedIntegrationEvent))]
[JsonSerializable(typeof(RoomReservedIntegrationEvent))]
[JsonSerializable(typeof(ReservationCancelledIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToCancelledIntegrationEvent))]
[JsonSerializable(typeof(SessionStartedIntegrationEvent))]
[JsonSerializable(typeof(SessionEndedIntegrationEvent))]
[JsonSerializable(typeof(SessionMemberJoinedIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToConfirmedIntegrationEvent))]
[JsonSerializable(typeof(OrderReminderIntegrationEvent))]
[JsonSerializable(typeof(TicketUpdatedIntegrationEvent))]
[JsonSerializable(typeof(CatalogItemAvailabilityChangedIntegrationEvent))]
public partial class NotificationIntegrationEventContext : JsonSerializerContext
{
}
