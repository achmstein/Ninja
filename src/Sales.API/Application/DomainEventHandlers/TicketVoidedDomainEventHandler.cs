using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A void undoes the sale, so it undoes what the sale earned: every order on
/// the ticket goes out as a full reversal of its value here, the way a
/// credit note reports what came back, and Loyalty claws the points back.
/// The floor nudge is the changed event's job, as for any change.
/// </summary>
public class TicketVoidedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketVoidedDomainEventHandler> logger) : INotificationHandler<TicketVoidedDomainEvent>
{
    public async Task Handle(TicketVoidedDomainEvent notification, CancellationToken cancellationToken)
    {
        var ticket = notification.Ticket;

        // Everything the order is worth on this ticket comes back: the same
        // denominator a refund reports, and here the numerator too
        var reversals = ticket.GetAmountByOrder()
            .Where(o => o.Value > 0)
            .Select(o => new RefundOrderReversal(o.Key, o.Value, o.Value))
            .ToList();

        logger.LogInformation(
            "Ticket {TicketId} voided by {VoidedBy} - reversing {Count} order(s) for Loyalty: {Reason}",
            ticket.Id, ticket.VoidedBy, reversals.Count, ticket.VoidReason);

        await integrationEvents.AddAndSaveEventAsync(new TicketVoidedIntegrationEvent(
            ticket.Id,
            ticket.BranchId,
            ticket.VoidReason ?? string.Empty,
            ticket.VoidedBy ?? string.Empty,
            reversals,
            ticket.PlaceId));
    }
}
