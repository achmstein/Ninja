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
}
