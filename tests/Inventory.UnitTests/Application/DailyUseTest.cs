#nullable enable
using Ninja.Inventory.API.Application.Queries;

namespace Inventory.UnitTests.Application;

/// <summary>What a branch uses of an item in a day, from what went out over the last two weeks.</summary>
[TestClass]
public class DailyUseTest
{
    private static readonly DateTime Now = new(2026, 11, 20, 12, 0, 0, DateTimeKind.Utc);

    [TestMethod]
    public void An_item_long_at_the_branch_is_averaged_over_the_two_weeks()
        => Assert.AreEqual(10m, DailyUse.Of(140, Now.AddDays(-90), Now));

    [TestMethod]
    public void A_new_item_is_averaged_over_the_days_it_has_been_there()
        => Assert.AreEqual(20m, DailyUse.Of(80, Now.AddDays(-4), Now));

    [TestMethod]
    public void An_item_that_arrived_today_counts_as_one_day()
        => Assert.AreEqual(6m, DailyUse.Of(6, Now.AddHours(-2), Now));

    [TestMethod]
    public void Nothing_out_on_balance_is_no_use()
    {
        Assert.IsNull(DailyUse.Of(0, Now.AddDays(-30), Now));
        Assert.IsNull(DailyUse.Of(-3, Now.AddDays(-30), Now));
    }
}
