namespace Chillax.Inventory.UnitTests.Application;

using Chillax.Inventory.API.Application.Services;
using Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;
using Chillax.Inventory.Domain.Services;

[TestClass]
public class ReplayGuardTest
{
    private static readonly DateTime Noon = new(2026, 9, 12, 12, 0, 0, DateTimeKind.Utc);

    private static readonly IReadOnlyList<MovementDraft> Drafts =
    [
        new(1, MovementType.Sale, -2, "order:9"),
        new(2, MovementType.Sale, -1, "order:9"),
    ];

    [TestMethod]
    public void A_sale_replayed_after_a_count_leaves_the_counted_item_alone()
    {
        var counted = new Dictionary<int, DateTime> { [1] = Noon.AddHours(1) };

        var kept = SaleDeduction.DropCountedAfter(Drafts, placedAt: Noon, counted);

        Assert.AreEqual(1, kept.Count);
        Assert.AreEqual(2, kept[0].StockItemId, "item 2 was never counted, so it is still taken");
    }

    [TestMethod]
    public void A_count_before_the_sale_changes_nothing()
    {
        var counted = new Dictionary<int, DateTime> { [1] = Noon.AddHours(-1), [2] = Noon.AddMinutes(-5) };

        Assert.AreEqual(2, SaleDeduction.DropCountedAfter(Drafts, Noon, counted).Count);
    }

    [TestMethod]
    public void A_live_sale_without_a_placed_time_is_always_taken()
    {
        var counted = new Dictionary<int, DateTime> { [1] = Noon.AddHours(1), [2] = Noon.AddHours(1) };

        Assert.AreEqual(2, SaleDeduction.DropCountedAfter(Drafts, placedAt: null, counted).Count);
    }
}
