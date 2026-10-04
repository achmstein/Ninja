#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// A confirmed order's stock is let go: Inventory hears of it through the
/// outbox, in the same transaction as the cancel or the void, and reverses the
/// order's sale as waste or back to the shelf.
/// </summary>
public class OrderStockReleasedDomainEventHandler(
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderStockReleasedDomainEventHandler> logger)
    : INotificationHandler<OrderStockReleasedDomainEvent>
{
    public async Task Handle(OrderStockReleasedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Order {OrderId} {Reason}: its stock goes as {Disposition}",
            domainEvent.OrderId, domainEvent.Reason, domainEvent.Disposition);

        await orderingIntegrationEventService.AddAndSaveEventAsync(new OrderStockReleasedIntegrationEvent(
            domainEvent.OrderId,
            domainEvent.BranchId,
            domainEvent.Disposition.ToString(),
            domainEvent.Reason.ToString()));
    }
}
