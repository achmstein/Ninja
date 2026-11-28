using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Items of an open bill were cancelled: the kitchen, the stock and the points
/// hear of it through the outbox, in the same transaction as the bill. The
/// floor nudge is the changed event's job, as for any change.
/// </summary>
public class TicketLinesCancelledDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketLinesCancelledDomainEventHandler> logger) : INotificationHandler<TicketLinesCancelledDomainEvent>
{
    public async Task Handle(TicketLinesCancelledDomainEvent notification, CancellationToken cancellationToken)
    {
        var ticket = notification.Ticket;

        var lines = notification.Lines
            .Select(c => new CancelledTicketLine(
                c.Line.OrderId,
                c.Line.CatalogItemId,
                new LocalizedText(c.Line.Description.En, c.Line.Description.Ar),
                c.Line.Details is null ? null : new LocalizedText(c.Line.Details.En, c.Line.Details.Ar),
                c.Qty))
            .ToList();

        var reversals = notification.Lines
            .Where(c => c.Line.OrderId is not null && c.Amount > 0)
            .GroupBy(c => c.Line.OrderId!.Value)
            .Select(g => new RefundOrderReversal(
                g.Key,
                g.Sum(c => c.Amount),
                notification.OriginalAmountByOrder.GetValueOrDefault(g.Key)))
            .ToList();

        logger.LogWarning(
            "Ticket {TicketId}: {Count} line(s) cancelled by {By}: {Reason}",
            ticket.Id, lines.Count, notification.CancelledBy, notification.Reason);

        await integrationEvents.AddAndSaveEventAsync(new TicketLinesCancelledIntegrationEvent(
            ticket.Id,
            ticket.BranchId,
            notification.Reason,
            notification.CancelledBy,
            lines,
            reversals,
            notification.StockDisposition));
    }
}
