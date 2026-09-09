using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.Events;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.DomainEventHandlers;

/// <summary>
/// Turns a customer assignment into the integration event that refreshes
/// every room screen, so the name shows up on other tills and the admin
/// without waiting for their poll.
/// </summary>
public class SessionCustomerAssignedDomainEventHandler(
    IEventBus eventBus,
    ILogger<SessionCustomerAssignedDomainEventHandler> logger) : INotificationHandler<SessionCustomerAssignedDomainEvent>
{
    public async Task Handle(SessionCustomerAssignedDomainEvent notification, CancellationToken cancellationToken)
    {
        var reservation = notification.Reservation;

        logger.LogInformation("Session customer assigned: ReservationId={ReservationId}, RoomId={RoomId}, CustomerId={CustomerId}",
            reservation.Id, reservation.RoomId, notification.CustomerId);

        await eventBus.PublishAsync(new SessionCustomerAssignedIntegrationEvent(
            reservation.Id,
            reservation.RoomId,
            notification.CustomerId,
            reservation.CustomerName,
            reservation.Room?.BranchId ?? 0));
    }
}
