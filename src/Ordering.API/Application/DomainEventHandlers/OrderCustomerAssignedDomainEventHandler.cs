#nullable enable
namespace Chillax.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Handler for OrderCustomerAssignedDomainEvent.
/// Publishes an integration event so Sales re-tags the bill and Loyalty
/// credits the customer the confirmation had nobody to credit — or, when the
/// order changed hands, moves the points from the account it left.
/// </summary>
public class OrderCustomerAssignedDomainEventHandler(
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderCustomerAssignedDomainEventHandler> logger)
    : INotificationHandler<OrderCustomerAssignedDomainEvent>
{
    public async Task Handle(OrderCustomerAssignedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = domainEvent.Order;

        logger.LogInformation(
            "Order {OrderId} assigned to customer {Customer} (was {Previous}) - publishing",
            order.Id,
            domainEvent.BuyerIdentityGuid ?? order.GuestName,
            domainEvent.PreviousBuyerIdentityGuid ?? "nobody");

        // The identities come off the event, not the Buyer rows: this runs
        // before the save, so a buyer created alongside is not queryable yet
        var integrationEvent = new OrderCustomerAssignedIntegrationEvent(
            order.Id,
            order.BranchId,
            domainEvent.BuyerIdentityGuid,
            order.GuestName,
            order.OrderStatus.ToString(),
            order.GetTotal(),
            domainEvent.PreviousBuyerIdentityGuid);

        await orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
