using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A customer was put on a session: every room screen refetches so the
/// name appears at once. The customer's own phone is told through the
/// member-joined event Spaces raises alongside this one.
/// </summary>
public class SessionCustomerAssignedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionCustomerAssignedIntegrationEventHandler> logger) : IIntegrationEventHandler<SessionCustomerAssignedIntegrationEvent>
{
    public async Task Handle(SessionCustomerAssignedIntegrationEvent @event)
    {
        logger.LogInformation("Session {ReservationId} in room {RoomId} assigned to {CustomerId} - notifying rooms group",
            @event.ReservationId, @event.RoomId, @event.CustomerId);

        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "customer_assigned",
            roomId = @event.RoomId,
            reservationId = @event.ReservationId
        });
    }
}
