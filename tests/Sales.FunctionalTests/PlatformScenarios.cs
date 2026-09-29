using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.FunctionalTests;

/// <summary>
/// A delivery platform's order reaching the bills: its own ticket named by the
/// platform's code, settled at once to the platform when the platform pays the
/// café, left open for the till when the café collects the cash itself.
/// </summary>
[TestClass]
public sealed class PlatformScenarios
{
    private static int _nextOrder = 900_000;

    private static OrderStatusChangedToConfirmedIntegrationEvent TalabatOrder(int orderId, bool platformSettles, string code = "42")
        => new(
            orderId,
            BuyerName: "Mona Adel",
            BuyerIdentityGuid: string.Empty,
            OrderTotal: 95m,
            PointsToRedeem: 0,
            GuestId: null,
            BranchId: Suite.Branch,
            SessionId: null,
            Source: "Talabat",
            GuestPhone: "+201001234567",
            LoyaltyDiscount: 0,
            Items: [new(12, new("Latte", "لاتيه"), 2, 47.50m, 0m, null)],
            CustomerName: "Mona Adel",
            Platform: "Talabat",
            PlatformCode: code,
            PlatformSettles: platformSettles);

    private static async Task DeliverAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(@event);
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
    public async Task An_order_the_platform_pays_for_settles_itself_to_the_platform()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await DeliverAsync(TalabatOrder(orderId, platformSettles: true));

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.TicketStatus.Settled, ticket.Status);
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.TicketType.Counter, ticket.Type);
        Assert.AreEqual("Talabat 42", ticket.Label);
        var payment = ticket.Payments.Single();
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.PaymentTender.Talabat, payment.Tender);
        Assert.AreEqual(ticket.Total, payment.Amount, "the platform pays the bill to the penny");
        Assert.AreEqual(95m, ticket.Total);
    }

    [TestMethod]
    public async Task Cash_the_cafe_collects_itself_stays_open_on_its_own_bill()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);

        await DeliverAsync(TalabatOrder(orderId, platformSettles: false, code: "77"));

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(Domain.AggregatesModel.TicketAggregate.TicketStatus.Open, ticket.Status);
        Assert.AreEqual("Talabat 77", ticket.Label);
        Assert.AreEqual(0, ticket.Payments.Count);
    }

    [TestMethod]
    public async Task Two_platform_orders_for_the_same_name_never_share_a_bill()
    {
        var first = Interlocked.Increment(ref _nextOrder);
        var second = Interlocked.Increment(ref _nextOrder);

        await DeliverAsync(TalabatOrder(first, platformSettles: false, code: "A1"));
        await DeliverAsync(TalabatOrder(second, platformSettles: false, code: "A2"));

        Assert.AreNotEqual((await TicketOfAsync(first)).Id, (await TicketOfAsync(second)).Id);
    }

    [TestMethod]
    public async Task A_redelivered_order_is_billed_once()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var @event = TalabatOrder(orderId, platformSettles: true);

        await DeliverAsync(@event);
        await DeliverAsync(@event);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(1, ticket.Payments.Count);
        Assert.AreEqual(1, ticket.Lines.Count);
    }
}
