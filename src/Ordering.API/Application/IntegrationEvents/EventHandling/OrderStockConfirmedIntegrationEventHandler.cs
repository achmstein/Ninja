namespace Chillax.Ordering.API.Application.IntegrationEvents.EventHandling;

public class OrderStockConfirmedIntegrationEventHandler(
    IOrderRepository orderRepository,
    IMediator mediator,
    ILogger<OrderStockConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockConfirmedIntegrationEvent>
{
    public async Task Handle(OrderStockConfirmedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var order = await orderRepository.GetAsync(@event.OrderId);

        if (order is null)
        {
            logger.LogWarning("Order {OrderId} not found for stock confirmation", @event.OrderId);
            return;
        }

        order.SetStockConfirmedStatus();

        await orderRepository.UnitOfWork.SaveEntitiesAsync();

        // A counter sale was keyed in by the cashier — the person who would
        // otherwise press Confirm — so it confirms itself the moment the items
        // check out. Customer and guest orders keep waiting for staff.
        //
        // Through the command, not the aggregate: confirming raises a domain
        // event whose handler writes the integration event to the outbox, and
        // that write needs the transaction TransactionBehavior opens around a
        // command. An integration-event handler runs outside the pipeline and
        // has none, so confirming here threw ArgumentNullException inside
        // SaveEntitiesAsync, the bus swallowed it, and the whole status change
        // rolled back — every POS order stalled in AwaitingValidation and no
        // ticket ever assembled from it.
        if (order.Source == OrderSource.Pos)
        {
            await mediator.Send(new ConfirmOrderCommand(order.Id));
        }

        logger.LogInformation(
            "Order {OrderId} stock confirmed - status changed to {Status}",
            @event.OrderId,
            order.OrderStatus);
    }
}
