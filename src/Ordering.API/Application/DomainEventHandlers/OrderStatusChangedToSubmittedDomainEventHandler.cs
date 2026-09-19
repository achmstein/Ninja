#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Handler for OrderStatusChangedToSubmittedDomainEvent.
/// Publishes the integration event that rings the tills and the admin board:
/// the order has passed the stock check and is now in the pending queue.
/// Raised here, not at order start, so the "new order" signal only fires once
/// a refetch of the pending list can actually return it.
/// </summary>
public class OrderStatusChangedToSubmittedDomainEventHandler(
    IOrderRepository orderRepository,
    IBuyerRepository buyerRepository,
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderStatusChangedToSubmittedDomainEventHandler> logger)
    : INotificationHandler<OrderStatusChangedToSubmittedDomainEvent>
{
    public async Task Handle(OrderStatusChangedToSubmittedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        OrderingApiTrace.LogOrderStatusUpdated(logger, domainEvent.OrderId, OrderStatus.Submitted);

        var order = await orderRepository.GetAsync(domainEvent.OrderId);

        if (order == null)
        {
            logger.LogWarning("Order {OrderId} not found", domainEvent.OrderId);
            return;
        }

        // An order with no identity behind it has no Buyer to hang off: a
        // guest announces itself under the name left at checkout, a walk-in
        // counter sale under a generic label.
        var buyer = order.BuyerId.HasValue
            ? await buyerRepository.FindByIdAsync(order.BuyerId.Value)
            : null;

        var integrationEvent = new OrderStatusChangedToSubmittedIntegrationEvent(
            order.Id,
            order.OrderStatus,
            buyer?.Name ?? order.GuestName ?? "Walk-in",
            buyer?.IdentityGuid ?? string.Empty,
            order.BranchId,
            buyer is null ? order.GuestId : null);

        await orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
