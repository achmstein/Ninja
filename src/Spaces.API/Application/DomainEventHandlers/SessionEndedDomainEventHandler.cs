using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.DomainEventHandlers;

public class SessionEndedDomainEventHandler : INotificationHandler<SessionEndedDomainEvent>
{
    private readonly IEventBus _eventBus;
    private readonly ILogger<SessionEndedDomainEventHandler> _logger;

    public SessionEndedDomainEventHandler(
        IEventBus eventBus,
        ILogger<SessionEndedDomainEventHandler> logger)
    {
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task Handle(SessionEndedDomainEvent notification, CancellationToken cancellationToken)
    {
        var reservation = notification.Reservation;

        _logger.LogInformation("Session ended: {ReservationId}, Room: {RoomId}, Cost: {Cost}",
            reservation.Id, reservation.RoomId, reservation.TotalCost);

        // Publish session ended event for FCM notification dismissal
        var memberIds = reservation.SessionMembers
            .Select(m => m.CustomerId)
            .ToList();
        if (reservation.CustomerId != null && !memberIds.Contains(reservation.CustomerId))
        {
            memberIds.Add(reservation.CustomerId);
        }

        var sessionEndedEvent = new SessionEndedIntegrationEvent(
            reservation.Id,
            reservation.RoomId,
            reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}"),
            memberIds);

        await _eventBus.PublishAsync(sessionEndedEvent);

        // Publish room available event for notifications
        var roomAvailableEvent = new RoomBecameAvailableIntegrationEvent(
            reservation.RoomId,
            reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}"),
            reservation.Room?.BranchId ?? 1);

        await _eventBus.PublishAsync(roomAvailableEvent);

        // Publish session completed event (for billing). Every real session
        // gets one — a cashier-started walk-in with no customer attached is
        // still a bill Sales has to settle; CustomerId simply travels null.
        if (reservation.ActualStartTime.HasValue && reservation.EndTime.HasValue)
        {
            var duration = reservation.EndTime.Value - reservation.ActualStartTime.Value;
            var sessionCompletedEvent = new SessionCompletedIntegrationEvent(
                reservation.Id,
                reservation.CustomerId,
                reservation.RoomId,
                reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}"),
                reservation.GetSingleCost(),
                reservation.GetMultiCost(),
                reservation.TotalCost ?? 0,
                reservation.GetSingleRoundedHours(),
                reservation.GetMultiRoundedHours(),
                reservation.ActualStartTime.Value,
                reservation.EndTime.Value,
                duration,
                reservation.Room?.BranchId ?? 1);

            await _eventBus.PublishAsync(sessionCompletedEvent);
        }
    }
}
