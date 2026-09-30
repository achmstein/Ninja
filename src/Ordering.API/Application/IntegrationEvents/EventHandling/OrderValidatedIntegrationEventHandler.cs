#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

public class OrderValidatedIntegrationEventHandler(
    IOrderRepository orderRepository,
    IMediator mediator,
    ILogger<OrderValidatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderValidatedIntegrationEvent>
{
    public async Task Handle(OrderValidatedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);
        await ValidateAsync(@event.OrderId, @event.Prices, @event.PromoCode, @event.PromoDiscount, @event.PromoReason, @event.Categories);
    }

    internal async Task ValidateAsync(
        int orderId,
        Dictionary<int, decimal>? prices,
        string? promoCodeAnswered,
        decimal promoDiscount,
        string? promoReason,
        Dictionary<int, int>? categories)
    {
        // Through commands, not the aggregate: both transitions raise domain
        // events whose handlers write integration events to the outbox, and
        // that write needs the transaction TransactionBehavior opens around a
        // command. An integration-event handler runs outside the pipeline and
        // has none. Calling the aggregate here threw ArgumentNullException
        // inside SaveEntitiesAsync, the bus swallowed it, and the whole status
        // change rolled back.
        if (promoReason is not null)
        {
            logger.LogInformation("Order {OrderId}: promo {Code} not applied ({Reason})", orderId, promoCodeAnswered, promoReason);
        }

        // A code that gave nothing is dropped from the order rather than kept
        // as a promise the bill will not honour
        var promoCode = promoDiscount > 0 ? promoCodeAnswered : null;
        var submitted = await mediator.Send(new SetOrderValidatedCommand(orderId, prices, promoCode, promoDiscount, categories));

        // Not found, or already past the check: this answer came before
        if (!submitted)
        {
            return;
        }

        var order = await orderRepository.GetAsync(orderId);

        // A counter sale was keyed in by the cashier, the person who would
        // otherwise press Confirm, so it confirms itself the moment the items
        // check out. Customer and guest orders keep waiting for staff.
        if (order?.Source == OrderSource.Pos)
        {
            await mediator.Send(new ConfirmOrderCommand(order.Id));
        }

        logger.LogInformation(
            "Order {OrderId} validated - status changed to {Status}",
            orderId,
            order?.OrderStatus);
    }
}

/// <summary>
/// Catalog's answer under its old name, from before it priced lines: read
/// for one release, for answers queued when the stack was upgraded. It
/// carries no prices, so the lines stand as the app sent them.
/// </summary>
public class OrderStockConfirmedIntegrationEventHandler(
    IOrderRepository orderRepository,
    IMediator mediator,
    ILogger<OrderValidatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockConfirmedIntegrationEvent>
{
    public Task Handle(OrderStockConfirmedIntegrationEvent @event)
        => new OrderValidatedIntegrationEventHandler(orderRepository, mediator, logger)
            .ValidateAsync(@event.OrderId, prices: null, @event.PromoCode, @event.PromoDiscount, @event.PromoReason, @event.Categories);
}
