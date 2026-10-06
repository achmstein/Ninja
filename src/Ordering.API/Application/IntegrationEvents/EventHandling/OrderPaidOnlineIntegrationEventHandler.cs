namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The customer paid an order ahead online: it goes to the till through a
/// command, so the write has a transaction. Idempotent: the aggregate ignores
/// a payment it already carries, so a redelivered event is harmless.
/// </summary>
public class OrderPaidOnlineIntegrationEventHandler(
    IMediator mediator,
    ILogger<OrderPaidOnlineIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderPaidOnlineIntegrationEvent>
{
    public async Task Handle(OrderPaidOnlineIntegrationEvent @event)
    {
        logger.LogInformation("Order {OrderId} paid online ({Amount}, payment {Key})", @event.OrderId, @event.Amount, @event.PaymentKey);
        await mediator.Send(new MarkOrderPaidOnlineCommand(
            @event.OrderId,
            @event.PaymentKey,
            @event.Amount,
            @event.PaidAt == default ? @event.CreationDate : @event.PaidAt));
    }
}
