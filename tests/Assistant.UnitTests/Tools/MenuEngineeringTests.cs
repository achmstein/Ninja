using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

/// <summary>The matrix the owner's "which items should I drop" is answered from, the back office's rule.</summary>
[TestClass]
public sealed class MenuEngineeringTests
{
    private static MenuEngineering.Item Item(int id, decimal price, decimal cost, decimal sold, bool placeable = true) =>
        new(id, price, cost, sold, placeable);

    [TestMethod]
    public void Places_each_item_by_its_share_of_what_sold_and_its_margin_against_the_weighted_average()
    {
        // An even split is 25%, so popular starts at 17.5%; the weighted average margin is 28
        var matrix = MenuEngineering.Place([Item(1, 60, 20, 50), Item(2, 40, 30, 30), Item(3, 60, 20, 10), Item(4, 20, 10, 10)]);

        Assert.AreEqual(0.175m, matrix.PopularShare);
        Assert.AreEqual(28m, matrix.AverageMargin);
        CollectionAssert.AreEqual(
            new[] { "star", "plowhorse", "puzzle", "dog" },
            matrix.Items.Select(d => d.Class).ToArray());
    }

    [TestMethod]
    public void An_item_with_an_unknown_cost_is_left_out_of_the_averages_and_unplaced()
    {
        var matrix = MenuEngineering.Place([Item(1, 60, 20, 50), Item(2, 40, 30, 30), Item(9, 50, 1, 500, placeable: false)]);

        Assert.IsNull(matrix.Items.Single(d => d.Item.Id == 9).Class);
        Assert.AreEqual(0.35m, matrix.PopularShare);
    }

    [TestMethod]
    public void Nothing_is_placed_when_nothing_sold()
    {
        var matrix = MenuEngineering.Place([Item(1, 60, 20, 0), Item(2, 40, 30, 0)]);

        Assert.IsTrue(matrix.NoSales);
        Assert.IsTrue(matrix.Items.All(d => d.Class is null));
    }

    [TestMethod]
    public async Task The_tool_reads_costs_menu_and_sales_per_branch_and_groups_items_by_class()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/items", _ => new object[]
        {
            new { id = 1, name = new { en = "Latte", ar = "لاتيه" }, price = 65m, catalogTypeId = 4, catalogTypeName = new { en = "Hot drinks", ar = "مشروبات ساخنة" }, isAvailable = true, customizations = Array.Empty<object>() },
            new { id = 2, name = new { en = "Croissant", ar = "كرواسون" }, price = 40m, catalogTypeId = 5, catalogTypeName = new { en = "Bakery", ar = "مخبوزات" }, isAvailable = true, customizations = Array.Empty<object>() },
        });
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/recipes/costs", _ => new object[]
        {
            new { catalogItemId = 1, baseCost = 19.5m, lines = Array.Empty<object>(), uncosted = Array.Empty<int>() },
            new { catalogItemId = 2, baseCost = 20m, lines = Array.Empty<object>(), uncosted = new[] { 99 } },
        });
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/breakdown", _ => new
        {
            byItem = new[]
            {
                new { description = new { en = "Latte", ar = "لاتيه" }, qty = 30, amount = 1950, tickets = 28, catalogItemId = 1 },
                new { description = new { en = "Croissant", ar = "كرواسون" }, qty = 12, amount = 480, tickets = 12, catalogItemId = 2 },
            },
        });

        var result = await new MenuReadTools(bench.Tenant, bench.Api, bench.Clock).GetMenuEngineering("last_30_days", null, null, "1", 10, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.IsTrue(bench.Handler.Requests.Where(q => q.Url.Host is "inventory-api" or "catalog-api" or "sales-api").All(q => q.Branch == "1"));
        var branch = Bench.JsonOf(result).GetProperty("branches")[0];
        var stars = branch.GetProperty("classes").GetProperty("star");
        Assert.AreEqual(1, stars.GetProperty("count").GetInt32());
        var latte = stars.GetProperty("items")[0];
        Assert.AreEqual("Latte", latte.GetProperty("item").GetString());
        Assert.AreEqual(1365m, latte.GetProperty("earned").GetDecimal());
        Assert.AreEqual(1, branch.GetProperty("notPlaced").GetProperty("count").GetInt32(), "the croissant's cost is a lower bound");
    }
}
