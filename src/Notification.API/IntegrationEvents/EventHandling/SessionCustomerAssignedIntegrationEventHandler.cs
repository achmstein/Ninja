using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A customer was put on a session: every room screen refetches so the
/// name appears at once, and the customer's own connection is told so
/// their "my session" view updates wherever they are in the app. (Their
/// phone's push comes from the member-joined event Spaces raises alongside.)
/// </summary>
public class SessionCustomerAssignedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionCustomerAssignedIntegrationEventHandler> logger) : IIntegrationEventHandler<SessionCustomerAssignedIntegrationEvent>
{
    public async Task Handle(SessionCustomerAssignedIntegrationEvent @event)
    {
        logger.LogInformation("Session {ReservationId} in room {RoomId} assigned to {CustomerId} - notifying rooms group",
            @event.ReservationId, @event.RoomId, @event.CustomerId);

        var payload = new
        {
            type = "customer_assigned",
            // LEGACY(places): roomId beside placeId, and the RoomId fallback for a PlaceId-less event — remove when every till and customer app is on /api/places and /api/stays.
            roomId = @event.RoomId,
            placeId = @event.PlaceId != 0 ? @event.PlaceId : @event.RoomId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        };
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", payload);
        await hubContext.Clients.Group($"user:{@event.CustomerId}").SendAsync("RoomStatusChanged", payload);
    }
}
