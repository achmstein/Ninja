#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Turns a delivery's move into the integration event the rider app, the
/// customer, the till and Sales each listen for. Logs ids and the stage only:
/// the customer's address and phone stay out of the logs.
/// </summary>
public class OrderDeliveryChangedDomainEventHandler(
    IBuyerRepository buyerRepository,
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderDeliveryChangedDomainEventHandler> logger)
    : INotificationHandler<OrderDeliveryChangedDomainEvent>
{
    public async Task Handle(OrderDeliveryChangedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = domainEvent.Order;
        var delivery = order.Delivery!;

        logger.LogInformation(
            "Order {OrderId} delivery -> {Stage} (version {Version}, cash in {CashIn})",
            order.Id, domainEvent.Stage, delivery.Version, domainEvent.CashHandedIn);

        var buyer = order.BuyerId.HasValue
            ? await buyerRepository.FindByIdAsync(order.BuyerId.Value)
            : null;

        await orderingIntegrationEventService.AddAndSaveEventAsync(new OrderDeliveryChangedIntegrationEvent(
            order.Id,
            order.BranchId,
            domainEvent.Stage.ToString(),
            delivery.RiderUserId,
            delivery.RiderName,
            domainEvent.PreviousRiderUserId,
            buyer?.IdentityGuid,
            order.GuestId,
            domainEvent.CashHandedIn,
            order.GetTotal(),
            delivery.Address,
            delivery.Version,
            delivery.CashCollected));
    }
}
