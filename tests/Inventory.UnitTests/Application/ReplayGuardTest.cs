namespace Ninja.Inventory.UnitTests.Application;

using Ninja.Inventory.API.Application.Services;
using Ninja.Inventory.Domain.AggregatesModel.LedgerAggregate;
using Ninja.Inventory.Domain.Services;

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
    public void A_sale_replayed_after_a_count_puts_the_counted_item_back_where_the_count_left_it()
    {
        var countedAt = Noon.AddHours(1);
        var counted = new Dictionary<int, DateTime> { [1] = countedAt };

        var corrections = SaleDeduction.CountedSince(9, Drafts, placedAt: Noon, counted);

        // The sale is still posted (its cost is the sale's); the count, which
        // booked the units as missing, is corrected by as much
        var correction = corrections.Single();
        Assert.AreEqual(1, correction.StockItemId, "item 2 was never counted, so the sale alone takes it");
        Assert.AreEqual(MovementType.Count, correction.Type);
        Assert.AreEqual(2m, correction.Quantity, "what the sale takes, back");
        Assert.AreEqual(countedAt, correction.OccurredAt, "on the count's day, where the shortfall was booked");
        Assert.AreEqual("order:9:counted", correction.Reference);
    }

    [TestMethod]
    public void A_count_before_the_sale_changes_nothing()
    {
        var counted = new Dictionary<int, DateTime> { [1] = Noon.AddHours(-1), [2] = Noon.AddMinutes(-5) };

        Assert.IsEmpty(SaleDeduction.CountedSince(9, Drafts, Noon, counted));
    }

    [TestMethod]
    public void A_live_sale_without_a_placed_time_is_never_corrected()
    {
        var counted = new Dictionary<int, DateTime> { [1] = Noon.AddHours(1), [2] = Noon.AddHours(1) };

        Assert.IsEmpty(SaleDeduction.CountedSince(9, Drafts, placedAt: null, counted));
    }
}
