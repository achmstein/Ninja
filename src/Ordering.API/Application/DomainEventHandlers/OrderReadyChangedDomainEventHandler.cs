#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Turns a kitchen move into the integration event that nudges every kitchen
/// screen on the branch. A pointer only — the screens refetch the queue.
/// </summary>
public class OrderReadyChangedDomainEventHandler(
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderReadyChangedDomainEventHandler> logger)
    : INotificationHandler<OrderReadyChangedDomainEvent>
{
    public async Task Handle(OrderReadyChangedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        logger.LogInformation("Order {OrderId} ready -> {IsReady}", domainEvent.OrderId, domainEvent.IsReady);

        var integrationEvent = new OrderReadyChangedIntegrationEvent(
            domainEvent.OrderId,
            domainEvent.BranchId,
            domainEvent.IsReady);

        await orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
