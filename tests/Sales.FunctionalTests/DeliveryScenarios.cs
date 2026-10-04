using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.FunctionalTests;

/// <summary>
/// The business's own delivery reaching the bills: a bill of its own with the
/// fee as a line and no service on it, left open while the rider is out, and
/// settled in cash when the rider hands the cash in at the till.
/// </summary>
[TestClass]
public sealed class DeliveryScenarios
{
    private static int _nextOrder = 970_000;

    private static OrderStatusChangedToConfirmedIntegrationEvent Delivered(int orderId, string buyer = "user-delivery")
        => new(
            orderId,
            BuyerName: "Mona Adel",
            BuyerIdentityGuid: buyer,
            OrderTotal: 115m,
            PointsToRedeem: 0,
            GuestId: null,
            BranchId: Suite.Branch,
            SessionId: null,
            Source: "Customer",
            GuestPhone: null,
            LoyaltyDiscount: 0,
            Items: [new(12, new("Latte", "لاتيه"), 2, 47.50m, 0m, null)],
            CustomerName: "Mona Adel",
            DeliveryFee: 20m);

    private static async Task ConfirmAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(@event);
    }

    private static async Task HandInAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderDeliveryChangedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new OrderDeliveryChangedIntegrationEvent(
            orderId, Suite.Branch, "Delivered", "rider-1", "Ali", null, "user-delivery", null,
            CashHandedIn: true, Total: 115m, Address: "Tahrir St"));
    }

    private static async Task<Domain.AggregatesModel.TicketAggregate.Ticket> TicketOfAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        return await db.Tickets
            .Include(t => t.Lines)
            .Include(t => t.Payments)
            .AsNoTracking()
            .SingleAsync(t => t.Lines.Any(l => l.OrderId == orderId));
    }

    [TestMethod]
    public async Task A_delivery_is_billed_alone_with_its_fee_and_waits_for_the_rider()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await ConfirmAsync(Delivered(orderId));

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.TicketStatus.Open, ticket.Status);
        Assert.AreEqual(2, ticket.Lines.Count);
        var fee = ticket.Lines.Single(l => l.Description.En == "Delivery fee");
        Assert.AreEqual(20m, fee.Total);
        Assert.AreEqual(orderId, fee.OrderId);
        StringAssert.Contains(ticket.Label, $"#{orderId}");
    }

    [TestMethod]
    public async Task Two_deliveries_for_the_same_customer_never_share_a_bill()
    {
        var first = Interlocked.Increment(ref _nextOrder);
        var second = Interlocked.Increment(ref _nextOrder);

        await ConfirmAsync(Delivered(first, buyer: "user-twice"));
        await ConfirmAsync(Delivered(second, buyer: "user-twice"));

        Assert.AreNotEqual((await TicketOfAsync(first)).Id, (await TicketOfAsync(second)).Id);
    }

    [TestMethod]
    public async Task The_rider_handing_the_cash_in_settles_it_in_cash_once()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(Delivered(orderId));

        await HandInAsync(orderId);
        await HandInAsync(orderId);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.TicketStatus.Settled, ticket.Status);
        var payment = ticket.Payments.Single();
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.PaymentTender.Cash, payment.Tender);
        Assert.AreEqual(ticket.Total, payment.Amount);
    }
}
