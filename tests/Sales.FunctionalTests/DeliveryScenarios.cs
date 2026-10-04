using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;
using TicketAggregate = Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.FunctionalTests;

/// <summary>
/// The business's own delivery reaching the bills: a bill of its own with the
/// fee as a line and no service on it, left open while the rider is out, and
/// settled in cash when the rider hands the cash in at the till — whichever of
/// the bill and the cash comes first, never for money nobody collected.
/// </summary>
[TestClass]
public sealed class DeliveryScenarios
{
    private static int _nextOrder = 970_000;

    private static OrderStatusChangedToConfirmedIntegrationEvent Delivered(int orderId, string buyer = "user-delivery", decimal? fee = 20m, bool isDelivery = false)
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
            DeliveryFee: fee,
            IsDelivery: isDelivery);

    private static async Task ConfirmAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(@event);
    }

    private static async Task HandInAsync(int orderId, decimal? collected = null)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderDeliveryChangedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new OrderDeliveryChangedIntegrationEvent(
            orderId, Suite.Branch, "Delivered", "rider-1", "Ali",
            CashHandedIn: true, Total: 115m, Version: 4, CashCollected: collected));
    }

    private static async Task<TicketAggregate.Ticket> TicketOfAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        return await db.Tickets
            .Include(t => t.Lines)
            .Include(t => t.Payments)
            .AsNoTracking()
            .SingleAsync(t => t.Lines.Any(l => l.OrderId == orderId));
    }

    private static async Task<DeliveryCashIn?> CashOfAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SalesContext>().DeliveryCashIns.AsNoTracking().SingleOrDefaultAsync(c => c.OrderId == orderId);
    }

    [TestMethod]
    public async Task A_delivery_is_billed_alone_with_its_fee_and_waits_for_the_rider()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await ConfirmAsync(Delivered(orderId));

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Open, ticket.Status);
        Assert.AreEqual(2, ticket.Lines.Count);
        var fee = ticket.Lines.Single(l => l.Description.En == "Delivery fee");
        Assert.AreEqual(20m, fee.Total);
        Assert.AreEqual(orderId, fee.OrderId);
        Assert.AreEqual($"#{orderId} · Mona Adel", ticket.Label, "plain text a receipt printer can print");
    }

    [TestMethod]
    public async Task A_free_delivery_said_outright_is_billed_alone_too()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await ConfirmAsync(Delivered(orderId, buyer: "user-free", fee: null, isDelivery: true));
        await ConfirmAsync(Delivered(Interlocked.Increment(ref _nextOrder), buyer: "user-free", fee: null, isDelivery: true));

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(1, ticket.Lines.Count, "no fee line for a free delivery");
        StringAssert.StartsWith(ticket.Label, $"#{orderId}");
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

        await HandInAsync(orderId, collected: 115m);
        await HandInAsync(orderId, collected: 115m);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Settled, ticket.Status);
        var payment = ticket.Payments.Single();
        Assert.AreEqual(TicketAggregate.PaymentTender.Cash, payment.Tender);
        Assert.AreEqual(ticket.Total, payment.Amount);
        Assert.AreEqual(DeliveryCashOutcome.Settled, (await CashOfAsync(orderId))!.Outcome);
    }

    [TestMethod]
    public async Task Cash_that_comes_before_its_bill_waits_and_settles_it_when_it_lands()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await HandInAsync(orderId, collected: 115m);
        Assert.AreEqual(DeliveryCashOutcome.Pending, (await CashOfAsync(orderId))!.Outcome, "kept, not dropped");

        await ConfirmAsync(Delivered(orderId));

        Assert.AreEqual(TicketAggregate.TicketStatus.Settled, (await TicketOfAsync(orderId)).Status);
        Assert.AreEqual(DeliveryCashOutcome.Settled, (await CashOfAsync(orderId))!.Outcome);
    }

    [TestMethod]
    public async Task A_rider_short_of_the_bill_leaves_it_open_for_the_till_and_the_shortfall_recorded()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(Delivered(orderId));

        await HandInAsync(orderId, collected: 100m);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Open, ticket.Status, "never settled for money nobody collected");
        Assert.IsEmpty(ticket.Payments);
        var cash = (await CashOfAsync(orderId))!;
        Assert.AreEqual(DeliveryCashOutcome.Short, cash.Outcome);
        Assert.AreEqual(-15m, cash.Difference);
    }

    [TestMethod]
    public async Task A_rider_over_the_bill_settles_it_and_the_difference_is_recorded()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(Delivered(orderId));

        await HandInAsync(orderId, collected: 120m);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Settled, ticket.Status);
        Assert.AreEqual(ticket.Total, ticket.Payments.Single().Amount, "the bill takes what it comes to");
        var cash = (await CashOfAsync(orderId))!;
        Assert.AreEqual(DeliveryCashOutcome.Over, cash.Outcome);
        Assert.AreEqual(5m, cash.Difference);
    }

    [TestMethod]
    public async Task A_delivery_cancelled_after_it_could_not_be_handed_over_has_its_bill_voided()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(Delivered(orderId));

        using (var scope = Suite.Sales.Services.CreateScope())
        {
            var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToCancelledIntegrationEventHandler>(scope.ServiceProvider);
            await handler.Handle(new OrderStatusChangedToCancelledIntegrationEvent(orderId));
            await handler.Handle(new OrderStatusChangedToCancelledIntegrationEvent(orderId));
        }

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Voided, ticket.Status, "no cash will come for it");
        Assert.AreEqual(OrderStatusChangedToCancelledIntegrationEventHandler.Reason, ticket.VoidReason);
    }

    [TestMethod]
    public async Task A_bill_the_till_settled_first_is_left_as_it_is()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(Delivered(orderId));
        var open = await TicketOfAsync(orderId);
        using (var scope = Suite.Sales.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IMediator>().Send(
                new SettleTicketCommand(open.Id, [new PaymentDto(TicketAggregate.PaymentTender.Cash, 115m)], "cashier"));
        }

        await HandInAsync(orderId, collected: 115m);

        var ticket = await TicketOfAsync(orderId);
        Assert.HasCount(1, ticket.Payments, "the till's settle, not a second one");
        Assert.AreEqual(DeliveryCashOutcome.SettledAtTill, (await CashOfAsync(orderId))!.Outcome);
    }
}
