#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Payments;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The order could not take an online payment (too late, paid twice, another
/// amount): that payment is given back to the customer. Idempotent: one given
/// back already is not paid any more.
/// </summary>
public class OrderOnlinePaymentRefusedIntegrationEventHandler(
    SalesTransaction transaction,
    IMediator mediator,
    PaymentMoves moves,
    ILogger<OrderOnlinePaymentRefusedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderOnlinePaymentRefusedIntegrationEvent>
{
    public async Task Handle(OrderOnlinePaymentRefusedIntegrationEvent @event)
    {
        IReadOnlyList<Guid> toGiveBack = [];
        await transaction.RunAsync(nameof(OrderOnlinePaymentRefusedIntegrationEvent), async () =>
        {
            logger.LogWarning("Order {OrderId} refused online payment {Key} ({Reason}): giving it back", @event.OrderId, @event.PaymentKey, @event.Reason);
            toGiveBack = await mediator.Send(new GiveBackOrderPaymentsCommand(@event.OrderId, @event.PaymentKey, "The order could not take this payment"));
        });
        foreach (var key in toGiveBack) await moves.TryRunAsync(key);
    }
}
