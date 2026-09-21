using Ninja.Spaces.API.Application.IntegrationEvents;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.SeedWork;
using MediatR;

namespace Ninja.Spaces.API.Application.DomainEventHandlers;

// Every handler here turns a domain event into the integration event the
// other services and the screens listen for. They run inside the unit of
// work (SpacesUnitOfWork) and queue the event on its outbox; it goes out
// after the commit, so a screen that refetches on hearing it reads the
// new state, and a failed commit sends nothing.

/// <summary>The place fields every Spaces event carries, from a stay whose Place may or may not be loaded.</summary>
internal static class StayEventFields
{
    public static int PlaceId(this Stay stay) => stay.PlaceId;
    public static string PlaceKind(this Stay stay) => (stay.Place?.Kind ?? Domain.AggregatesModel.PlaceAggregate.PlaceKind.Room).ToString();
    public static LocalizedText PlaceName(this Stay stay) => stay.Place?.Name ?? new LocalizedText($"Place {stay.PlaceId}");
    public static int BranchId(this Stay stay) => stay.Place?.BranchId ?? 1;

    /// <summary>Everyone in the party, owner included, each once.</summary>
    public static List<string> PartyIds(this Stay stay)
    {
        var ids = stay.Members.Select(m => m.CustomerId).ToList();
        if (stay.CustomerId is { } owner && !ids.Contains(owner))
            ids.Add(owner);
        return ids;
    }
}

public class StayHeldDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayHeldDomainEventHandler> logger)
    : INotificationHandler<StayHeldDomainEvent>
{
    public async Task Handle(StayHeldDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay held: {StayId} at place {PlaceId} for {Customer}", stay.Id, stay.PlaceId, stay.CustomerName ?? "Unknown");

        await outbox.AddAndSaveEventAsync(new PlaceReservedIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            stay.CustomerId,
            stay.CustomerName,
            stay.ExpiresAt,
            stay.BranchId(),
            stay.StartOnConfirm));
    }
}

public class StayStartedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayStartedDomainEventHandler> logger)
    : INotificationHandler<StayStartedDomainEvent>
{
    public async Task Handle(StayStartedDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay started: {StayId} at place {PlaceId} on {Option}", stay.Id, stay.PlaceId, stay.CurrentOptionCode);

        await outbox.AddAndSaveEventAsync(new SessionStartedIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            stay.CustomerId,
            stay.StartedAt,
            stay.CurrentOptionCode,
            stay.BranchId()));
    }
}

public class StayEndedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayEndedDomainEventHandler> logger)
    : INotificationHandler<StayEndedDomainEvent>
{
    public async Task Handle(StayEndedDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay ended: {StayId} at place {PlaceId}, cost {Cost}", stay.Id, stay.PlaceId, stay.TotalCost);

        // The party's devices drop their stay notification
        await outbox.AddAndSaveEventAsync(new SessionEndedIntegrationEvent(
            stay.Id, stay.PlaceId, stay.PlaceKind(), stay.PlaceName(), stay.PartyIds()));

        // Whoever asked to be told the place is free
        await outbox.AddAndSaveEventAsync(new PlaceBecameAvailableIntegrationEvent(
            stay.PlaceId, stay.PlaceKind(), stay.PlaceName(), stay.BranchId()));

        // The bill. Every real stay gets one — a walk-in nobody claimed is
        // still a bill Sales has to settle; CustomerId simply travels null.
        if (stay.StartedAt is { } started && stay.EndedAt is { } ended)
        {
            var costs = stay.CostBreakdown()
                .Select(c => new SessionCostLine(c.OptionCode, c.OptionName, c.HourlyRate, c.Hours, c.Cost))
                .ToList();

            await outbox.AddAndSaveEventAsync(new SessionCompletedIntegrationEvent(
                stay.Id,
                stay.CustomerId,
                stay.PlaceId,
                stay.PlaceKind(),
                stay.PlaceName(),
                costs,
                stay.TotalCost ?? 0,
                started,
                ended,
                ended - started,
                stay.BranchId()));
        }
    }
}

public class StayCancelledDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayCancelledDomainEventHandler> logger)
    : INotificationHandler<StayCancelledDomainEvent>
{
    public async Task Handle(StayCancelledDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay cancelled: {StayId}, was {PreviousStatus}", stay.Id, notification.PreviousStatus);

        await outbox.AddAndSaveEventAsync(new ReservationCancelledIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            stay.CustomerId,
            stay.CustomerName,
            stay.BranchId(),
            notification.PreviousStatus == StayStatus.Running));

        // A hold and a running stay both kept the place; either way it is free now
        if (notification.PreviousStatus is StayStatus.Running or StayStatus.Held)
        {
            await outbox.AddAndSaveEventAsync(new PlaceBecameAvailableIntegrationEvent(
                stay.PlaceId, stay.PlaceKind(), stay.PlaceName(), stay.BranchId()));
        }
    }
}

public class StayMemberJoinedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayMemberJoinedDomainEventHandler> logger)
    : INotificationHandler<StayMemberJoinedDomainEvent>
{
    public async Task Handle(StayMemberJoinedDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay member joined: {StayId} at place {PlaceId}, member {MemberId}", stay.Id, stay.PlaceId, notification.MemberUserId);

        await outbox.AddAndSaveEventAsync(new SessionMemberJoinedIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            notification.MemberUserId,
            stay.StartedAt,
            stay.CurrentOptionCode));
    }
}

public class StayCustomerAssignedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayCustomerAssignedDomainEventHandler> logger)
    : INotificationHandler<StayCustomerAssignedDomainEvent>
{
    public async Task Handle(StayCustomerAssignedDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay customer assigned: {StayId} at place {PlaceId}, customer {CustomerId}", stay.Id, stay.PlaceId, notification.CustomerId);

        await outbox.AddAndSaveEventAsync(new SessionCustomerAssignedIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            notification.CustomerId,
            stay.CustomerName,
            stay.BranchId()));
    }
}

/// <summary>What Ordering and Notification project: a place's identity and capabilities.</summary>
public class PlaceChangedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<PlaceChangedDomainEventHandler> logger)
    : INotificationHandler<PlaceChangedDomainEvent>
{
    public async Task Handle(PlaceChangedDomainEvent notification, CancellationToken cancellationToken)
    {
        var place = notification.Place;
        logger.LogInformation("Place changed: {PlaceId} {Kind} {Name}", place.Id, place.Kind, place.Name.En);
        await outbox.AddAndSaveEventAsync(place.ToUpdatedEvent());
    }
}

public static class PlaceEventMapping
{
    public static PlaceUpdatedIntegrationEvent ToUpdatedEvent(this Place place, bool deleted = false) => new PlaceUpdatedIntegrationEvent(
        place.Id,
        place.Kind.ToString(),
        place.Name,
        place.BranchId,
        place.IsTimed,
        place.HasOptions,
        place.IsActive,
        deleted);
}

/// <summary>The bill with this stay's time on it was paid: everyone in the party gets their list refreshed.</summary>
public class StayPaidDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<StayPaidDomainEventHandler> logger)
    : INotificationHandler<StayPaidDomainEvent>
{
    public async Task Handle(StayPaidDomainEvent notification, CancellationToken cancellationToken)
    {
        var stay = notification.Stay;
        logger.LogInformation("Stay {StayId} paid on receipt #{Receipt} ({Tender})", stay.Id, notification.ReceiptNumber, stay.PaidWith);

        await outbox.AddAndSaveEventAsync(new SessionPaidIntegrationEvent(
            stay.Id,
            stay.PlaceId,
            stay.PlaceKind(),
            stay.PlaceName(),
            stay.PartyIds(),
            notification.ReceiptNumber,
            notification.BranchId));
    }
}

/// <summary>What Ordering and Notification drop: a deleted place.</summary>
public class PlaceDeletedDomainEventHandler(ISpacesIntegrationEventService outbox, ILogger<PlaceDeletedDomainEventHandler> logger)
    : INotificationHandler<PlaceDeletedDomainEvent>
{
    public async Task Handle(PlaceDeletedDomainEvent notification, CancellationToken cancellationToken)
    {
        var place = notification.Place;
        logger.LogInformation("Place deleted: {PlaceId} {Kind} {Name}", place.Id, place.Kind, place.Name.En);
        await outbox.AddAndSaveEventAsync(place.ToUpdatedEvent(deleted: true));
    }
}
