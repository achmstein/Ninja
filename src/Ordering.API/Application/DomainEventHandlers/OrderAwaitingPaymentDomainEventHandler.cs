#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// An order paid ahead is priced: Sales is told what to take, from whom and
/// by when, so the customer's app can start the payment. Through the outbox,
/// in the transaction that priced the order.
/// </summary>
public class OrderAwaitingPaymentDomainEventHandler(
    IBuyerRepository buyerRepository,
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderAwaitingPaymentDomainEventHandler> logger)
    : INotificationHandler<OrderAwaitingPaymentDomainEvent>
{
    public async Task Handle(OrderAwaitingPaymentDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = domainEvent.Order;
        var buyer = order.BuyerId.HasValue ? await buyerRepository.FindByIdAsync(order.BuyerId.Value) : null;

        logger.LogInformation("Order {OrderId} waits for its online payment of {Total} until {DueBy}",
            order.Id, order.GetTotal(), order.PaymentDueBy);

        await orderingIntegrationEventService.AddAndSaveEventAsync(new OrderAwaitingPaymentIntegrationEvent(
            order.Id,
            order.BranchId,
            order.GetTotal(),
            buyer?.IdentityGuid,
            buyer is null ? order.GuestId : null,
            buyer?.Name ?? order.GuestName ?? "Customer",
            order.Delivery?.Phone ?? order.GuestPhone,
            order.IsDelivery,
            order.PaymentDueBy ?? DateTime.UtcNow + Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order.PayAheadWindow));
    }
}
