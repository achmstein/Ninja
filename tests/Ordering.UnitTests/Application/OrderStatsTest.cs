namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Infrastructure;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// The dashboard's order statistics count the orders the business took on:
/// confirmed and never voided at the till, in a window whose end is the next
/// window's start. Revenue is what was paid, every discount and refund off,
/// and the items rank by it, all of them when asked, so branches add up.
/// </summary>
[TestClass]
public class OrderStatsTest
{
    private const int Branch = 1;
    private static readonly DateTime From = new(2026, 10, 20, 6, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = From.AddDays(1);

    private static OrderingContext NewContext() =>
        new(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);

    private static DomainOrder Order(DateTime at, int productId, string name, decimal price, int units, decimal discount = 0, decimal promo = 0, bool confirm = true)
    {
        var order = new DomainOrder("user-1", "Mona", Branch, placedAt: at);
        order.AddOrderItem(productId, new LocalizedText(name, null), price, discount, null, units);
        order.SetValidatedStatus(promoCode: promo > 0 ? "TEN" : null, promoDiscount: promo);
        if (confirm)
            order.SetConfirmedStatus();
        return order;
    }

    private static async Task<OrderStats> StatsAsync(Action<OrderingContext> seed, TimeZoneInfo? zone = null, TimeOnly dayStart = default, int top = 10)
    {
        await using var context = NewContext();
        seed(context);
        await context.SaveChangesAsync();
        return await new OrderQueries(context).GetOrderStatsAsync(Branch, From, To, 0, zone, dayStart, top);
    }

    [TestMethod]
    public async Task Only_orders_the_business_took_on_count()
    {
        var stats = await StatsAsync(context =>
        {
            context.Orders.Add(Order(From.AddHours(1), 12, "Latte", 50, 2));
            // Still waiting for the kitchen to accept it: not a sale yet
            context.Orders.Add(Order(From.AddHours(2), 13, "Cake", 500, 1, confirm: false));
            // Voided at the till: Ordering keeps it Confirmed, but it was never paid
            var voided = Order(From.AddHours(3), 14, "Tea", 10, 10);
            voided.MarkVoided(From.AddHours(4));
            context.Orders.Add(voided);
            // On the window's end: the next window's
            context.Orders.Add(Order(To, 13, "Cake", 120, 1));
        });

        var day = stats.Days.Single();
        Assert.AreEqual(1, day.Orders);
        Assert.AreEqual(100d, day.Revenue);
        Assert.AreEqual(12, stats.TopItems.Single().ProductId);
    }

    [TestMethod]
    public async Task Revenue_is_net_of_discounts_promo_and_refunds_and_items_rank_by_it()
    {
        var stats = await StatsAsync(context =>
        {
            // Two lattes, 10 off the line, a 9 promo: 81
            context.Orders.Add(Order(From.AddHours(1), 12, "Latte", 50, 2, discount: 10, promo: 9));
            // One cake at 120, 20 of it given back
            var cake = Order(From.AddHours(2), 13, "Cake", 120, 1);
            cake.RecordRefund(20);
            context.Orders.Add(cake);
        });

        Assert.AreEqual(181d, stats.Days.Single().Revenue);
        CollectionAssert.AreEqual(new[] { 13, 12 }, stats.TopItems.Select(i => i.ProductId).ToArray(), "by money, not by units");
        Assert.AreEqual(81d, stats.TopItems.Single(i => i.ProductId == 12).Revenue);
        Assert.AreEqual(2, stats.TopItems.Single(i => i.ProductId == 12).Units);
    }

    [TestMethod]
    public async Task Every_item_comes_back_when_asked_for_all()
    {
        void Seed(OrderingContext context)
        {
            for (var id = 1; id <= 12; id++)
                context.Orders.Add(Order(From.AddMinutes(id), id, $"Item {id}", id, 1));
        }

        Assert.HasCount(10, (await StatsAsync(Seed)).TopItems, "ten by default, as the dashboard shows");
        Assert.HasCount(12, (await StatsAsync(Seed, top: 0)).TopItems);
    }

    [TestMethod]
    public async Task Days_are_business_days_in_the_zone_asked_for()
    {
        var stats = await StatsAsync(
            context =>
            {
                // 05:00 in a zone two hours ahead is 07:00, after a 06:00 day start; 03:30 is 05:30, the day before
                context.Orders.Add(Order(new DateTime(2026, 10, 20, 6, 30, 0, DateTimeKind.Utc), 12, "Latte", 50, 1));
                context.Orders.Add(Order(new DateTime(2026, 10, 21, 3, 30, 0, DateTimeKind.Utc), 12, "Latte", 50, 1));
            },
            TimeZoneInfo.CreateCustomTimeZone("Test/Plus2", TimeSpan.FromHours(2), "Plus 2", "Plus 2"),
            new TimeOnly(6, 0));

        var day = stats.Days.Single();
        Assert.AreEqual(new DateOnly(2026, 10, 20), day.Date);
        Assert.AreEqual(2, day.Orders);
    }
}
