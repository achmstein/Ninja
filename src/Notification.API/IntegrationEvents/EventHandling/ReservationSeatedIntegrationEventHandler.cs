using Microsoft.AspNetCore.SignalR;
using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A party sat down at a plain table on their reservation. Nothing to push:
/// the till that seated them is looking at the floor, and the customer is
/// at the table. The screens refetch — the floor shows the table taken, the
/// customer's phone shows where they sit.
/// </summary>
public class ReservationSeatedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<ReservationSeatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<ReservationSeatedIntegrationEvent>
{
    public Task Handle(ReservationSeatedIntegrationEvent @event)
        => FloorChange.Relay(hubContext, logger, "reservation_seated", @event.ReservationId, @event.PlaceId, @event.PlaceKind, @event.CustomerId);
}

/// <summary>The party left a plain table: the floor shows it free, the customer's phone drops it.</summary>
public class ReservationCompletedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<ReservationCompletedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<ReservationCompletedIntegrationEvent>
{
    public Task Handle(ReservationCompletedIntegrationEvent @event)
        => FloorChange.Relay(hubContext, logger, "reservation_completed", @event.ReservationId, @event.PlaceId, @event.PlaceKind, @event.CustomerId);
}

/// <summary>One RoomStatusChanged to the floor and to the customer it concerns.</summary>
internal static class FloorChange
{
    public static async Task Relay(IHubContext<NotificationHub> hubContext, ILogger logger, string type, int reservationId, int placeId, string placeKind, string? customerId)
    {
        logger.LogInformation("Relaying {Type}: reservation {ReservationId} at place {PlaceId}", type, reservationId, placeId);
        var change = new { type, placeId, placeKind, reservationId };
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", change);
        if (!string.IsNullOrEmpty(customerId))
            await hubContext.Clients.Group($"user:{customerId}").SendAsync("RoomStatusChanged", change);
    }
}
