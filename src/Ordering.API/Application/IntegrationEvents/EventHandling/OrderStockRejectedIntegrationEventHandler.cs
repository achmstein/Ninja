namespace Chillax.Ordering.API.Application.IntegrationEvents.EventHandling;

public class OrderStockRejectedIntegrationEventHandler(
    IMediator mediator,
    ILogger<OrderStockRejectedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockRejectedIntegrationEvent>
{
    public async Task Handle(OrderStockRejectedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var unavailableProductIds = @event.OrderStockItems
            .Where(x => !x.HasStock)
            .Select(x => x.ProductId)
            .ToList();

        // Through a command, not the aggregate: cancelling raises a domain
        // event whose handler writes the cancelled integration event to the
        // outbox, and that write needs the transaction TransactionBehavior
        // opens around a command (see OrderStockConfirmedIntegrationEventHandler).
        var cancelled = await mediator.Send(new SetOrderStockRejectedCommand(@event.OrderId, unavailableProductIds));

        if (!cancelled)
        {
            return;
        }

        logger.LogWarning("Order {OrderId} cancelled due to unavailable items: {UnavailableItems}",
            @event.OrderId, string.Join(", ", unavailableProductIds));
    }
}
