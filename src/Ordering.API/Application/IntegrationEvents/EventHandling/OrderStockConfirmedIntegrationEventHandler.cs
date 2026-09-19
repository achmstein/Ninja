namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

public class OrderStockConfirmedIntegrationEventHandler(
    IOrderRepository orderRepository,
    IMediator mediator,
    ILogger<OrderStockConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockConfirmedIntegrationEvent>
{
    public async Task Handle(OrderStockConfirmedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        // Through commands, not the aggregate: both transitions raise domain
        // events whose handlers write integration events to the outbox, and
        // that write needs the transaction TransactionBehavior opens around a
        // command. An integration-event handler runs outside the pipeline and
        // has none. Calling the aggregate here threw ArgumentNullException
        // inside SaveEntitiesAsync, the bus swallowed it, and the whole status
        // change rolled back.
        if (@event.PromoReason is not null)
        {
            logger.LogInformation("Order {OrderId}: promo {Code} not applied ({Reason})", @event.OrderId, @event.PromoCode, @event.PromoReason);
        }

        // A code that gave nothing is dropped from the order rather than kept
        // as a promise the bill will not honour
        var promoCode = @event.PromoDiscount > 0 ? @event.PromoCode : null;
        var submitted = await mediator.Send(new SetOrderStockConfirmedCommand(@event.OrderId, promoCode, @event.PromoDiscount));

        if (!submitted)
        {
            logger.LogWarning("Order {OrderId} not found for stock confirmation", @event.OrderId);
            return;
        }

        var order = await orderRepository.GetAsync(@event.OrderId);

        // A counter sale was keyed in by the cashier, the person who would
        // otherwise press Confirm, so it confirms itself the moment the items
        // check out. Customer and guest orders keep waiting for staff.
        if (order?.Source == OrderSource.Pos)
        {
            await mediator.Send(new ConfirmOrderCommand(order.Id));
        }

        logger.LogInformation(
            "Order {OrderId} stock confirmed - status changed to {Status}",
            @event.OrderId,
            order?.OrderStatus);
    }
}
