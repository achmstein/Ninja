#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Items of an open bill were cancelled at the till: each order they came
/// from strikes them for the kitchen, and lets their stock go. Under the
/// event's own id, because the bus redelivers and a strike adds up.
/// </summary>
public class TicketLinesCancelledIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketLinesCancelledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketLinesCancelledIntegrationEvent>
{
    public async Task Handle(TicketLinesCancelledIntegrationEvent @event)
    {
        var lines = (@event.Lines ?? []).Where(l => l.OrderId is not null && l.Qty > 0).ToList();
        if (lines.Count == 0)
        {
            return;
        }

        logger.LogInformation("Ticket {TicketId}: {Count} cancelled line(s) to strike on their orders", @event.TicketId, lines.Count);

        // What the cashier said becomes of the food, when they said it
        StockDisposition? disposition = Enum.TryParse<StockDisposition>(@event.StockDisposition, ignoreCase: true, out var said) && Enum.IsDefined(said)
            ? said
            : null;

        var orders = lines
            .GroupBy(l => l.OrderId!.Value)
            .Select(g => new OrderItemsToCancel(
                g.Key,
                g.Select(l => new ItemCancel(
                    l.CatalogItemId,
                    l.Description ?? new LocalizedText(),
                    LocalizedText.Optional(l.Details),
                    (int)Math.Ceiling(l.Qty))).ToList()))
            .ToList();

        await mediator.Send(new IdentifiedCommand<CancelOrderItemsCommand, bool>(
            new CancelOrderItemsCommand(orders, @event.Reason, @event.CreationDate, disposition, @event.Id),
            @event.Id));
    }
}
