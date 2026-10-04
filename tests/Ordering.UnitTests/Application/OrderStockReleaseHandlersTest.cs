namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.DomainEventHandlers;
using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// The cashier's word on a voided bill reaches the orders on it, and a
/// released order goes out to Inventory as one event through the outbox.
/// </summary>
[TestClass]
public class OrderStockReleaseHandlersTest
{
    private static TicketVoidedIntegrationEvent Voided(string? disposition) =>
        new(7, 1, "Walked out", "owner", [new RefundOrderReversal(41, 50, 50)], StockDisposition: disposition);

    [TestMethod]
    [DataRow("Waste", StockDisposition.Waste)]
    [DataRow("Restock", StockDisposition.Restock)]
    [DataRow(null, null)]
    [DataRow("Burnt", null)]
    public async Task A_voided_bill_carries_what_the_cashier_said_to_its_orders(string? said, StockDisposition? expected)
    {
        var mediator = Substitute.For<IMediator>();
        var handler = new TicketVoidedIntegrationEventHandler(mediator, NullLogger<TicketVoidedIntegrationEventHandler>.Instance);

        await handler.Handle(Voided(said));

        await mediator.Received(1).Send(
            Arg.Is<MarkOrdersVoidedCommand>(c => c.OrderNumbers.Single() == 41 && c.StockDisposition == expected),
            Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task A_released_order_goes_to_Inventory_through_the_outbox()
    {
        var outbox = Substitute.For<IOrderingIntegrationEventService>();
        var handler = new OrderStockReleasedDomainEventHandler(outbox, NullLogger<OrderStockReleasedDomainEventHandler>.Instance);

        await handler.Handle(
            new OrderStockReleasedDomainEvent(41, 3, StockDisposition.Waste, StockReleaseReason.PlatformCancelled),
            CancellationToken.None);

        await outbox.Received(1).AddAndSaveEventAsync(Arg.Is<OrderStockReleasedIntegrationEvent>(e =>
            e.OrderId == 41 && e.BranchId == 3 && e.Disposition == "Waste" && e.Reason == "PlatformCancelled"));
    }
}
