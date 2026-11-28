using Ninja.Inventory.API.Application.Services;
using Ninja.Inventory.Domain.AggregatesModel.LedgerAggregate;

namespace Ninja.Inventory.UnitTests.Application;

[TestClass]
public class SaleReleaseTest
{
    private const int Order = 41;

    private static StockMovement Sold(int stockItemId, decimal quantity, decimal unitCost) =>
        new(1, stockItemId, MovementType.Sale, -quantity, unitCost, SaleDeduction.ReferenceFor(Order), null, "system");

    [TestMethod]
    public void Food_never_made_reverses_the_sale_at_what_it_cost()
    {
        var drafts = SaleRelease.BuildDrafts(Order, SaleRelease.Restock, [Sold(7, 0.04m, 300m)], new Dictionary<int, DateTime>());

        var reversal = drafts.Single();
        Assert.AreEqual(MovementType.SaleReversal, reversal.Type);
        Assert.AreEqual(0.04m, reversal.Quantity);
        Assert.AreEqual(300m, reversal.UnitCost, "back at the cost it went out at");
        Assert.AreEqual("order:41:released", reversal.Reference);
    }

    [TestMethod]
    public void Food_made_reverses_the_sale_then_writes_the_same_off()
    {
        var drafts = SaleRelease.BuildDrafts(Order, SaleRelease.Waste, [Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m)], new Dictionary<int, DateTime>());

        Assert.HasCount(4, drafts);
        Assert.AreEqual(0m, drafts.Where(d => d.StockItemId == 7).Sum(d => d.Quantity), "the shelf stays as it is");
        var waste = drafts.Where(d => d.Type == MovementType.Waste).ToList();
        CollectionAssert.AreEquivalent(new[] { -0.04m, -0.2m }, waste.Select(d => d.Quantity).ToArray());
        Assert.IsTrue(waste.All(d => d.Reference == "order:41:waste" && d.UnitCost is null));
        Assert.IsLessThan(
            drafts.ToList().FindIndex(d => d.StockItemId == 7 && d.Type == MovementType.Waste),
            drafts.ToList().FindIndex(d => d.StockItemId == 7 && d.Type == MovementType.SaleReversal),
            "the reversal comes before the write-off on the same item");
    }

    [TestMethod]
    public void The_sale_leaves_the_books_on_its_own_day_and_the_waste_is_todays()
    {
        // Rung up on the last evening of March, called off on 1 April
        var soldAt = new DateTime(2026, 3, 31, 19, 0, 0, DateTimeKind.Utc);
        var sale = new StockMovement(1, 7, MovementType.Sale, -0.04m, 300m, SaleDeduction.ReferenceFor(Order), null, "system", occurredAt: soldAt);

        var drafts = SaleRelease.BuildDrafts(Order, SaleRelease.Waste, [sale], new Dictionary<int, DateTime>());

        Assert.AreEqual(soldAt, drafts.Single(d => d.Type == MovementType.SaleReversal).OccurredAt, "March's sale, given back in March");
        Assert.IsNull(drafts.Single(d => d.Type == MovementType.Waste).OccurredAt, "the food goes in the bin when the order is called off");
    }

    [TestMethod]
    public void A_sale_that_went_out_at_nothing_leaves_the_average_alone()
    {
        var drafts = SaleRelease.BuildDrafts(Order, SaleRelease.Restock, [Sold(7, 1m, 0m)], new Dictionary<int, DateTime>());

        Assert.IsNull(drafts.Single().UnitCost);
    }

    [TestMethod]
    public void Food_never_made_and_counted_since_is_not_put_back_twice()
    {
        var sale = new[] { Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m) };
        var counted = new Dictionary<int, DateTime> { [7] = DateTime.UtcNow.AddMinutes(5) };

        var restock = SaleRelease.BuildDrafts(Order, SaleRelease.Restock, sale, counted);
        var waste = SaleRelease.BuildDrafts(Order, SaleRelease.Waste, sale, counted);

        Assert.AreEqual(9, restock.Single().StockItemId, "the count already found the beans on the shelf");
        Assert.HasCount(4, waste, "the count saw made food gone, as it is");
    }

    // ---- Some items of the order cancelled at the till ----

    private static readonly Guid Key = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private static StockMovement GivenBack(int stockItemId, decimal quantity, Guid key) =>
        new(1, stockItemId, MovementType.SaleReversal, quantity, 300m, SaleRelease.PartReferenceFor(Order, key), null, "system");

    private static StockMovement PartWaste(int stockItemId, decimal quantity, Guid key) =>
        new(1, stockItemId, MovementType.Waste, -quantity, 0m, SaleRelease.PartWasteReferenceFor(Order, key), null, "system");

    [TestMethod]
    public void Cancelled_items_never_made_come_back_off_the_sale_at_its_cost_and_day()
    {
        var soldAt = new DateTime(2026, 3, 31, 19, 0, 0, DateTimeKind.Utc);
        var sale = new[]
        {
            new StockMovement(1, 7, MovementType.Sale, -0.04m, 300m, SaleDeduction.ReferenceFor(Order), null, "system", occurredAt: soldAt),
            Sold(9, 0.2m, 30m),
        };

        var drafts = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Restock,
            new Dictionary<int, decimal> { [7] = 0.02m }, sale, [], new Dictionary<int, DateTime>());

        var reversal = drafts.Single();
        Assert.AreEqual(7, reversal.StockItemId, "only what the cancelled items' recipes take");
        Assert.AreEqual(MovementType.SaleReversal, reversal.Type);
        Assert.AreEqual(0.02m, reversal.Quantity);
        Assert.AreEqual(300m, reversal.UnitCost);
        Assert.AreEqual(soldAt, reversal.OccurredAt, "given back on the sale's own day");
        Assert.AreEqual($"order:41:part:{Key:N}", reversal.Reference);
        Assert.StartsWith(SaleRelease.PartPrefixFor(Order), reversal.Reference!);
    }

    [TestMethod]
    public void Cancelled_items_made_come_back_then_go_out_as_waste()
    {
        var drafts = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste,
            new Dictionary<int, decimal> { [7] = 0.02m, [9] = 0.1m }, [Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m)], [], new Dictionary<int, DateTime>());

        Assert.HasCount(4, drafts);
        Assert.IsTrue(drafts.Take(2).All(d => d.Type == MovementType.SaleReversal), "the reversals before the write-offs");
        var waste = drafts.Skip(2).ToList();
        Assert.IsTrue(waste.All(d => d.Type == MovementType.Waste && d.UnitCost is null && d.OccurredAt is null));
        Assert.IsTrue(waste.All(d => d.Reference == $"order:41:part:{Key:N}:waste"));
        CollectionAssert.AreEquivalent(new[] { -0.02m, -0.1m }, waste.Select(d => d.Quantity).ToArray());
        Assert.AreEqual(0m, drafts.Where(d => d.StockItemId == 7).Sum(d => d.Quantity), "the shelf stays as it is");
    }

    [TestMethod]
    public void A_part_release_never_gives_back_more_than_the_sale_took_less_earlier_parts()
    {
        var earlier = Guid.NewGuid();
        var sale = new[] { Sold(7, 0.04m, 300m) };

        // 0.03 already came back; 0.02 more is asked, 0.01 is all that is left
        var capped = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste,
            new Dictionary<int, decimal> { [7] = 0.02m }, sale, [GivenBack(7, 0.03m, earlier), PartWaste(7, 0.03m, earlier)], new Dictionary<int, DateTime>());

        Assert.AreEqual(0.01m, capped.Single(d => d.Type == MovementType.SaleReversal).Quantity);
        Assert.AreEqual(-0.01m, capped.Single(d => d.Type == MovementType.Waste).Quantity, "the earlier part's waste is not given back");

        // Everything already back: nothing
        var none = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Restock,
            new Dictionary<int, decimal> { [7] = 0.02m }, sale, [GivenBack(7, 0.04m, earlier)], new Dictionary<int, DateTime>());
        Assert.IsEmpty(none);

        // Asked for more than the sale took: the sale's amount
        var whole = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Restock,
            new Dictionary<int, decimal> { [7] = 1m }, sale, [], new Dictionary<int, DateTime>());
        Assert.AreEqual(0.04m, whole.Single().Quantity);
    }

    [TestMethod]
    public void Cancelled_items_never_made_and_counted_since_are_not_put_back_twice()
    {
        var sale = new[] { Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m) };
        var counted = new Dictionary<int, DateTime> { [7] = DateTime.UtcNow.AddMinutes(5) };
        var wanted = new Dictionary<int, decimal> { [7] = 0.02m, [9] = 0.1m };

        var restock = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Restock, wanted, sale, [], counted);
        var waste = SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste, wanted, sale, [], counted);

        Assert.AreEqual(9, restock.Single().StockItemId, "the count already found the beans on the shelf");
        Assert.HasCount(4, waste, "made food is gone whatever the count says");

        // Counted before the sale: it still comes back
        var countedBefore = new Dictionary<int, DateTime> { [7] = DateTime.UtcNow.AddDays(-1) };
        Assert.HasCount(2, SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Restock, wanted, sale, [], countedBefore));
    }

    [TestMethod]
    public void Nothing_asked_or_nothing_sold_releases_nothing()
    {
        var sale = new[] { Sold(7, 0.04m, 300m) };

        Assert.IsEmpty(SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste, new Dictionary<int, decimal>(), sale, [], new Dictionary<int, DateTime>()));
        Assert.IsEmpty(SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste, new Dictionary<int, decimal> { [7] = 0m }, sale, [], new Dictionary<int, DateTime>()));
        Assert.IsEmpty(SaleRelease.BuildPartDrafts(Order, Key, SaleRelease.Waste, new Dictionary<int, decimal> { [8] = 1m }, sale, [], new Dictionary<int, DateTime>()),
            "an item the sale never took");
    }

    [TestMethod]
    public void The_whole_order_released_after_a_part_reverses_only_the_rest()
    {
        var earlier = Guid.NewGuid();
        var sale = new[] { Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m) };
        var givenBack = new[] { GivenBack(7, 0.01m, earlier), PartWaste(7, 0.01m, earlier) };

        var restock = SaleRelease.BuildDrafts(Order, SaleRelease.Restock, sale, new Dictionary<int, DateTime>(), givenBack);
        var waste = SaleRelease.BuildDrafts(Order, SaleRelease.Waste, sale, new Dictionary<int, DateTime>(), givenBack);

        Assert.AreEqual(0.03m, restock.Single(d => d.StockItemId == 7).Quantity, "0.04 sold, 0.01 already back");
        Assert.AreEqual(0.2m, restock.Single(d => d.StockItemId == 9).Quantity);
        Assert.IsTrue(restock.All(d => d.Reference == "order:41:released"));
        Assert.AreEqual(-0.03m, waste.Single(d => d.StockItemId == 7 && d.Type == MovementType.Waste).Quantity);
        Assert.AreEqual(0.03m, waste.Single(d => d.StockItemId == 7 && d.Type == MovementType.SaleReversal).Quantity);
    }

    [TestMethod]
    public void The_whole_order_released_after_all_of_it_was_given_back_releases_nothing()
    {
        var sale = new[] { Sold(7, 0.04m, 300m), Sold(9, 0.2m, 30m) };
        var givenBack = new[] { GivenBack(7, 0.04m, Guid.NewGuid()), GivenBack(9, 0.1m, Guid.NewGuid()), GivenBack(9, 0.1m, Guid.NewGuid()) };

        Assert.IsEmpty(SaleRelease.BuildDrafts(Order, SaleRelease.Waste, sale, new Dictionary<int, DateTime>(), givenBack));
        Assert.IsEmpty(SaleRelease.BuildDrafts(Order, SaleRelease.Restock, sale, new Dictionary<int, DateTime>(), givenBack));
    }
}
