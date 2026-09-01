using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.DomainEventHandlers;

public class RoomReservedDomainEventHandler : INotificationHandler<RoomReservedDomainEvent>
{
    private readonly IEventBus _eventBus;
    private readonly ILogger<RoomReservedDomainEventHandler> _logger;

    public RoomReservedDomainEventHandler(
        IEventBus eventBus,
        ILogger<RoomReservedDomainEventHandler> logger)
    {
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task Handle(RoomReservedDomainEvent notification, CancellationToken cancellationToken)
    {
        var reservation = notification.Reservation;

        _logger.LogInformation("Room reserved: ReservationId={ReservationId}, RoomId={RoomId}, Customer={CustomerName}",
            reservation.Id, reservation.RoomId, reservation.CustomerName ?? "Unknown");

        // Publish integration event to notify admin/staff
        var roomName = reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}");
        var roomReservedEvent = new RoomReservedIntegrationEvent(
            reservation.Id,
            reservation.RoomId,
            roomName,
            reservation.CustomerId,
            reservation.CustomerName,
            reservation.ExpiresAt,
            reservation.Room?.BranchId ?? 1);

        await _eventBus.PublishAsync(roomReservedEvent);
    }
}
