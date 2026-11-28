#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Items of an order were cancelled at the till. In the same transaction:
/// a slip is queued for every station that prints and makes some of them,
/// the shop's screens and print hosts are woken (the kitchen screens refetch
/// and show them struck), and Inventory hears what stock to let go.
/// </summary>
public class OrderItemsCancelledDomainEventHandler(
    IKitchenStationRepository stations,
    IKitchenPrintJobRepository printJobs,
    IOrderingIntegrationEventService integrationEvents,
    ILogger<OrderItemsCancelledDomainEventHandler> logger)
    : INotificationHandler<OrderItemsCancelledDomainEvent>
{
    public async Task Handle(OrderItemsCancelledDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var printing = (await stations.GetForBranchAsync(domainEvent.BranchId))
            .Where(s => s.PrintsTickets)
            .Select(s => s.Id)
            .ToHashSet();

        foreach (var station in domainEvent.Items.Where(i => i.StationId is { } id && printing.Contains(id)).GroupBy(i => i.StationId!.Value))
        {
            printJobs.Add(KitchenPrintJob.Cancellation(domainEvent.BranchId, domainEvent.OrderId, station.Key, station.Select(i => new KitchenCancelledItem
            {
                NameEn = i.ProductName.En,
                NameAr = i.ProductName.Ar,
                DetailsEn = i.CustomizationsDescription?.En,
                DetailsAr = i.CustomizationsDescription?.Ar,
                Units = i.Units,
                Reason = domainEvent.Reason,
            })));
        }

        await integrationEvents.AddAndSaveEventAsync(new KitchenTicketQueuedIntegrationEvent(domainEvent.BranchId));

        if (domainEvent.Disposition is { } disposition)
        {
            await integrationEvents.AddAndSaveEventAsync(new OrderItemsStockReleasedIntegrationEvent(
                domainEvent.OrderId,
                domainEvent.BranchId,
                domainEvent.Key,
                disposition.ToString(),
                domainEvent.Items.Select(i => new ReleasedOrderItem(i.ProductId, i.Units, i.OptionIds)).ToList()));
        }

        logger.LogInformation(
            "Order {OrderId}: {Count} item line(s) cancelled, stock {Disposition}",
            domainEvent.OrderId, domainEvent.Items.Count, domainEvent.Disposition?.ToString() ?? "left alone");
    }
}
