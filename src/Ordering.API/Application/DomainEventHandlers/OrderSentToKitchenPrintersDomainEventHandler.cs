#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Queues a ticket for every station that prints its part of a confirmed
/// order, in the same transaction as the confirmation, and tells the shop's
/// print hosts there is paper to put out.
/// </summary>
public class OrderSentToKitchenPrintersDomainEventHandler(
    IKitchenPrintJobRepository printJobs,
    IOrderingIntegrationEventService orderingIntegrationEventService,
    ILogger<OrderSentToKitchenPrintersDomainEventHandler> logger)
    : INotificationHandler<OrderSentToKitchenPrintersDomainEvent>
{
    public async Task Handle(OrderSentToKitchenPrintersDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        foreach (var stationId in domainEvent.StationIds)
        {
            printJobs.Add(KitchenPrintJob.ForOrder(domainEvent.BranchId, domainEvent.OrderId, stationId));
        }

        logger.LogInformation("Order {OrderId}: {Count} kitchen ticket(s) queued", domainEvent.OrderId, domainEvent.StationIds.Count);

        await orderingIntegrationEventService.AddAndSaveEventAsync(
            new KitchenTicketQueuedIntegrationEvent(domainEvent.BranchId));
    }
}
