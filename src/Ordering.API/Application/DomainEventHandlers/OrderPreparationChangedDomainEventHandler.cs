#nullable enable
namespace Chillax.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Turns a kitchen move into the integration event that nudges every kitchen
/// screen on the branch. A pointer only — the screens refetch the queue.
/// </summary>
public class OrderPreparationChangedDomainEventHandler(
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderPreparationChangedDomainEventHandler> logger)
    : INotificationHandler<OrderPreparationChangedDomainEvent>
{
    public async Task Handle(OrderPreparationChangedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        logger.LogInformation("Order {OrderId} preparation -> {Preparation}", domainEvent.OrderId, domainEvent.Preparation);

        var integrationEvent = new OrderPreparationChangedIntegrationEvent(
            domainEvent.OrderId,
            domainEvent.BranchId,
            domainEvent.Preparation.ToString());

        await orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
