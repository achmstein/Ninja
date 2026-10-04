#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Turns a delivery's move into the integration event the rider app, the
/// customer, the till and Sales each listen for.
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
            "Order {OrderId} delivery -> {Stage} (rider {Rider}, cash in {CashIn})",
            order.Id, domainEvent.Stage, delivery.RiderUserId, domainEvent.CashHandedIn);

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
            delivery.Address));
    }
}
