using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till paid a bill with a stay's time on it: the stay learns its
/// receipt number and tender, which is what the customer's list shows next
/// to the cost. A direct write like the branch-settings projection — the
/// aggregate raises no domain event for the write itself; MarkPaid raises
/// the one that tells the party (StayPaidDomainEventHandler). Idempotent: a
/// receipt already carried is ignored.
///
/// A plain table's bill, with no stay on it: the party seated there on
/// their reservation is done with it, and the table is free — the same
/// rule the customer's phone applies to a table they scanned.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IStayRepository stays,
    IReservationRepository reservations,
    IPlaceRepository places,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.SessionId is not { } stayId)
        {
            if (@event.PlaceId is { } placeId)
                await PartyLeft(placeId, @event.TicketId);
            return;
        }
        var stay = await stays.GetWithMembersAsync(stayId);
        if (stay is null)
        {
            logger.LogWarning("Ticket {TicketId} settled stay {StayId}, which Spaces does not know", @event.TicketId, stayId);
            return;
        }
        var at = @event.SettledAt == default ? @event.CreationDate : @event.SettledAt;
        if (!stay.MarkPaid(@event.ReceiptNumber, @event.Tender ?? "Mixed", at, @event.TicketId, @event.BranchId))
        {
            return;
        }
        stays.Update(stay);
        await stays.UnitOfWork.SaveEntitiesAsync();
    }

    private async Task PartyLeft(int placeId, int ticketId)
    {
        var party = await reservations.GetSeatedAtAsync(placeId);
        if (party is null)
        {
            return;
        }
        party.Complete();
        reservations.Update(party);
        if (await places.GetAsync(placeId) is { } place)
        {
            place.SetAvailable();
            places.Update(place);
        }
        await reservations.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Ticket {TicketId} settled at place {PlaceId}: reservation {ReservationId} completed, the table is free", ticketId, placeId, party.Id);
    }
}
