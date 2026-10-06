#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Payments;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// An order paid ahead waits for its payment: Sales records what to take, so
/// the customer's app can start the payment against it. Idempotent.
/// </summary>
public class OrderAwaitingPaymentIntegrationEventHandler(
    SalesTransaction transaction,
    IMediator mediator,
    ILogger<OrderAwaitingPaymentIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderAwaitingPaymentIntegrationEvent>
{
    public Task Handle(OrderAwaitingPaymentIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderAwaitingPaymentIntegrationEvent), async () =>
        {
            var recorded = await mediator.Send(new RecordOrderPaymentDueCommand(
                @event.OrderId, @event.BranchId, @event.Total, @event.BuyerIdentityGuid, @event.GuestId,
                @event.BuyerName, @event.Phone, @event.IsDelivery, @event.DueBy));
            logger.LogInformation("Order {OrderId} waits for an online payment of {Total} until {DueBy}{Repeat}",
                @event.OrderId, @event.Total, @event.DueBy, recorded ? "" : " (already recorded)");
        });
}
