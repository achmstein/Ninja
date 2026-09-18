using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till paid a bill with a stay's time on it: the stay learns its
/// receipt number and tender, which is what the customer's list shows next
/// to the cost. A direct write like the branch-settings projection — the
/// aggregate raises no domain event for the write itself; MarkPaid raises
/// the one that tells the party (StayPaidDomainEventHandler). Idempotent: a
/// receipt already carried is ignored.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IStayRepository stays,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.SessionId is not { } stayId)
        {
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
}
