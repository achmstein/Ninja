using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.DomainEventHandlers;

public class ReservationCancelledDomainEventHandler : INotificationHandler<ReservationCancelledDomainEvent>
{
    private readonly IEventBus _eventBus;
    private readonly ILogger<ReservationCancelledDomainEventHandler> _logger;

    public ReservationCancelledDomainEventHandler(
        IEventBus eventBus,
        ILogger<ReservationCancelledDomainEventHandler> logger)
    {
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task Handle(ReservationCancelledDomainEvent notification, CancellationToken cancellationToken)
    {
        var reservation = notification.Reservation;
        var roomName = reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}");

        _logger.LogInformation("Reservation cancelled: {ReservationId}, Previous status: {PreviousStatus}",
            reservation.Id, notification.PreviousStatus);

        // Notify admins about the cancellation
        var cancellationEvent = new ReservationCancelledIntegrationEvent(
            reservation.Id,
            reservation.RoomId,
            roomName,
            reservation.CustomerId,
            reservation.CustomerName,
            reservation.Room?.BranchId ?? 1);

        await _eventBus.PublishAsync(cancellationEvent);

        // Publish room available event for any cancellation that frees the room
        // (both Reserved and Active statuses occupy the room)
        if (notification.PreviousStatus == ReservationStatus.Active ||
            notification.PreviousStatus == ReservationStatus.Reserved)
        {
            var roomAvailableEvent = new RoomBecameAvailableIntegrationEvent(
                reservation.RoomId,
                roomName,
                reservation.Room?.BranchId ?? 1);

            await _eventBus.PublishAsync(roomAvailableEvent);
        }
    }
}
