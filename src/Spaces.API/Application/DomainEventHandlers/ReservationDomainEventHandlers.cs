using Ninja.Spaces.API.Application.IntegrationEvents;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.SeedWork;
using MediatR;

namespace Ninja.Spaces.API.Application.DomainEventHandlers;

// The reservation's events, turned into what staff screens and the
// customer's phone listen for. Same outbox, same rule as the stay's
// handlers: queued inside the unit of work, sent after the commit.

/// <summary>The place fields every reservation event carries, from a reservation whose Place may or may not be loaded.</summary>
internal static class ReservationEventFields
{
    public static string PlaceKind(this Reservation r) => (r.Place?.Kind ?? Domain.AggregatesModel.PlaceAggregate.PlaceKind.Table).ToString();
    public static LocalizedText PlaceName(this Reservation r) => r.Place?.Name ?? new LocalizedText($"Place {r.PlaceId}");
}

public class ReservationRequestedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<ReservationRequestedDomainEventHandler> logger)
    : INotificationHandler<ReservationRequestedDomainEvent>
{
    public async Task Handle(ReservationRequestedDomainEvent notification, CancellationToken cancellationToken)
    {
        var r = notification.Reservation;
        logger.LogInformation("Reservation requested: {ReservationId} at place {PlaceId} for {Customer} at {For}",
            r.Id, r.PlaceId, r.CustomerName ?? "Unknown", r.For?.ToString("u") ?? "now");

        await outbox.AddAndSaveEventAsync(new PlaceReservedIntegrationEvent(
            r.Id,
            r.PlaceId,
            r.PlaceKind(),
            r.PlaceName(),
            r.CustomerId,
            r.CustomerName,
            r.ExpiresAt,
            r.BranchId,
            r.StartOnConfirm,
            r.For,
            r.PartySize));
    }
}

/// <summary>
/// The party sat down. At a timed place the stay that took over announces
/// its own start, which is what the screens and Sales act on; at a plain
/// table nobody else needs telling — the till that seated them refetches,
/// and the ticket on the table is Sales' own doing.
/// </summary>
public class ReservationSeatedDomainEventHandler(ILogger<ReservationSeatedDomainEventHandler> logger)
    : INotificationHandler<ReservationSeatedDomainEvent>
{
    public Task Handle(ReservationSeatedDomainEvent notification, CancellationToken cancellationToken)
    {
        var r = notification.Reservation;
        logger.LogInformation("Reservation seated: {ReservationId} at place {PlaceId}, stay {StayId}", r.Id, r.PlaceId, r.StayId);
        return Task.CompletedTask;
    }
}

public class ReservationCancelledDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<ReservationCancelledDomainEventHandler> logger)
    : INotificationHandler<ReservationCancelledDomainEvent>
{
    public async Task Handle(ReservationCancelledDomainEvent notification, CancellationToken cancellationToken)
    {
        var r = notification.Reservation;
        logger.LogInformation("Reservation cancelled: {ReservationId} at place {PlaceId}", r.Id, r.PlaceId);

        await outbox.AddAndSaveEventAsync(new ReservationCancelledIntegrationEvent(
            r.Id,
            r.PlaceId,
            r.PlaceKind(),
            r.PlaceName(),
            r.CustomerId,
            r.CustomerName,
            r.BranchId,
            WasRunning: false));

        // It was keeping the place; whoever asked to be told it is free, is told
        if (notification.WasHolding)
        {
            await outbox.AddAndSaveEventAsync(new PlaceBecameAvailableIntegrationEvent(
                r.PlaceId, r.PlaceKind(), r.PlaceName(), r.BranchId));
        }
    }
}
