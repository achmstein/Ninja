using System.Net;
using Ninja.Testing;

namespace Ninja.Inventory.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static ServiceUnderTest<Program> Inventory { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Inventory = new ServiceUnderTest<Program>("inventorydb");
        _ = Inventory.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Inventory.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record ItemView(int Id, LocalizedView Name, string Unit, decimal? PackSize, string? PackName, bool AutoSoldOut, bool IsActive);
public record LevelView(int StockItemId, LocalizedView Name, string Unit, decimal OnHand, decimal? ReorderLevel, decimal AvgUnitCost, bool IsLow, decimal Value, decimal? LastCost);
public record MovementView(int StockItemId, string Type, decimal Quantity, string? Reason);
public record PageView<T>(List<T> Items, int TotalCount);
public record CreatedView(int Id);
public record LocalizedView(string En, string? Ar);

/// <summary>
/// The storeroom: what a café keeps, what a delivery and a count do to what
/// is on hand, what it is worth, and when it is time to order more.
/// </summary>
[TestClass]
public sealed class StoreroomScenarios
{
    private const string Inventory = "/api/inventory";
    private const string Version = "api-version=1.0";

    private static Caller BackOffice => Suite.Inventory.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Owner => Suite.Inventory.As(Persona.Owner(Suite.Branch), Suite.Branch);

    private static string Url(string tail = "") => $"{Inventory}{tail}?{Version}";

    private static async Task<int> AnItemAsync(string name = "Coffee beans", string unit = "kg", decimal? packSize = null, string? packName = null)
    {
        var created = await BackOffice.PostAsync<CreatedView>(Url("/items"), new
        {
            name = new { en = $"{name} {Guid.NewGuid():N}"[..Math.Min(20, name.Length + 5)], ar = name },
            unit,
            packSize,
            packName,
            autoSoldOut = true,
        });
        return created.Id;
    }

    private static async Task<List<MovementView>> LedgerAsync(int stockItemId)
    {
        var page = await BackOffice.GetAsync<PageView<MovementView>>($"{Inventory}/movements?stockItemId={stockItemId}&{Version}");
        return page.Items;
    }

    private static async Task<LevelView> LevelAsync(int stockItemId)
    {
        var levels = await BackOffice.GetAsync<List<LevelView>>(Url("/levels"));
        return levels.Single(l => l.StockItemId == stockItemId);
    }

    [TestMethod]
    public async Task What_the_cafe_keeps_is_listed_with_nothing_on_hand_until_something_arrives()
    {
        var id = await AnItemAsync("Beans", "kg");

        var items = await BackOffice.GetAsync<List<ItemView>>(Url("/items"));
        var item = items.Single(i => i.Id == id);
        Assert.AreEqual("kg", item.Unit);
        Assert.IsTrue(item.IsActive);

        var level = await LevelAsync(id);
        Assert.AreEqual(0m, level.OnHand, "nothing is on hand until a delivery says so");
        Assert.AreEqual(0m, level.Value);
    }

    [TestMethod]
    public async Task A_delivery_puts_stock_on_the_shelf_and_gives_it_a_cost()
    {
        var id = await AnItemAsync("Beans", "kg");

        var purchase = await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The roastery",
            invoiceRef = "INV-42",
            lines = new[] { new { stockItemId = id, quantity = 10m, unitCost = 300m } },
        });
        Assert.IsGreaterThan(0, purchase.Id);

        var level = await LevelAsync(id);
        Assert.AreEqual(10m, level.OnHand);
        Assert.AreEqual(300m, level.AvgUnitCost, "what it cost is what it is valued at");
        Assert.AreEqual(3000m, level.Value);
        Assert.AreEqual(300m, level.LastCost);

        // A second delivery at a different price: the shelf is worth the average of what is on it
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The roastery",
            invoiceRef = "INV-43",
            lines = new[] { new { stockItemId = id, quantity = 10m, unitCost = 400m } },
        });

        var after = await LevelAsync(id);
        Assert.AreEqual(20m, after.OnHand);
        Assert.AreEqual(350m, after.AvgUnitCost, "ten at three hundred and ten at four");
        Assert.AreEqual(400m, after.LastCost, "and the last price paid is remembered on its own");
    }

    [TestMethod]
    public async Task Waste_comes_off_the_shelf_and_says_why()
    {
        var id = await AnItemAsync("Milk", "l");
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The dairy",
            lines = new[] { new { stockItemId = id, quantity = 20m, unitCost = 30m } },
        });

        var (posted, detail) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new
        {
            stockItemId = id,
            type = 2,
            quantity = 5m,
            reason = "Left out overnight",
        });
        Assert.AreEqual(HttpStatusCode.OK, posted, detail);

        Assert.AreEqual(15m, (await LevelAsync(id)).OnHand, "five litres went down the sink");

        var waste = (await LedgerAsync(id)).Single(m => m.Type == "Waste");
        Assert.AreEqual("Left out overnight", waste.Reason, "waste is written down with its reason");
        Assert.AreEqual(-5m, waste.Quantity, "and it is written down as stock leaving");

        // A minus sign keyed into waste is still waste: it goes out again, it does not come back
        var (keyedMinus, why) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 2, quantity = -3m, reason = "Keyed with a minus" });
        Assert.AreEqual(HttpStatusCode.OK, keyedMinus, why);
        Assert.AreEqual(12m, (await LevelAsync(id)).OnHand, "three more litres gone, not three back");
    }

    [TestMethod]
    public async Task A_count_makes_the_shelf_say_what_is_really_there()
    {
        var id = await AnItemAsync("Sugar", "kg");
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The grocer",
            lines = new[] { new { stockItemId = id, quantity = 10m, unitCost = 20m } },
        });

        var count = await BackOffice.PostAsync<CreatedView>(Url("/counts"), new
        {
            note = "Monday morning",
            lines = new[] { new { stockItemId = id, counted = 8.5m } },
        });
        Assert.IsGreaterThan(0, count.Id);

        Assert.AreEqual(8.5m, (await LevelAsync(id)).OnHand, "the count is the truth, whatever the ledger said");
        var correction = (await LedgerAsync(id)).Single(m => m.Type == "Count");
        Assert.AreEqual(-1.5m, correction.Quantity, "and the difference is written down, not the count");
    }

    [TestMethod]
    public async Task An_item_is_low_when_it_falls_to_its_reorder_level()
    {
        var id = await AnItemAsync("Tea bags", "box");
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The grocer",
            lines = new[] { new { stockItemId = id, quantity = 10m, unitCost = 50m } },
        });

        var (set, detail) = await BackOffice.RefusedAsync(HttpMethod.Put, Url($"/items/{id}/reorder-level"), new { reorderLevel = 4m });
        Assert.AreEqual(HttpStatusCode.OK, set, detail);
        Assert.IsFalse((await LevelAsync(id)).IsLow, "ten boxes is not low");

        await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 2, quantity = 7m, reason = "A busy Friday" });

        var low = await LevelAsync(id);
        Assert.AreEqual(3m, low.OnHand);
        Assert.IsTrue(low.IsLow, "three boxes against a level of four is time to order");
    }

    [TestMethod]
    public async Task A_recipe_says_what_a_sale_takes_off_the_shelf_and_what_it_costs()
    {
        var beans = await AnItemAsync("Beans", "kg");
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The roastery",
            lines = new[] { new { stockItemId = beans, quantity = 10m, unitCost = 300m } },
        });
        const int menuItem = 4242;

        var (saved, detail) = await BackOffice.RefusedAsync(HttpMethod.Put, Url($"/recipes/{menuItem}"), new
        {
            lines = new[] { new { stockItemId = beans, quantity = 0.02m } },
        });
        Assert.AreEqual(HttpStatusCode.OK, saved, detail);

        var recipe = await BackOffice.GetAsync<RecipeView>(Url($"/recipes/{menuItem}"));
        Assert.AreEqual(0.02m, recipe.Lines.Single().Quantity, "twenty grams to a cup");

        var costs = await BackOffice.GetAsync<List<RecipeCostView>>(Url("/recipes/costs"));
        var cost = costs.Single(c => c.CatalogItemId == menuItem);
        Assert.AreEqual(6m, cost.BaseCost, "twenty grams of three-hundred-pound beans");
        Assert.IsEmpty(cost.Uncosted, "nothing on this recipe is a guess");

        var (removed, _) = await BackOffice.RefusedAsync(HttpMethod.Delete, Url($"/recipes/{menuItem}"));
        Assert.AreEqual(HttpStatusCode.NoContent, removed, "the item is no longer tracked");
        Assert.IsFalse((await BackOffice.GetAsync<List<RecipeCostView>>(Url("/recipes/costs"))).Any(c => c.CatalogItemId == menuItem));
    }

    [TestMethod]
    public async Task What_the_storeroom_refuses_to_write_down()
    {
        var id = await AnItemAsync();

        var (empty, detail) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/purchases"), new { supplier = "Nobody", lines = Array.Empty<object>() });
        Assert.AreEqual(HttpStatusCode.BadRequest, empty);
        Assert.IsNotEmpty(detail, "and the storeroom is told why");

        var (unknownItem, _) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/purchases"), new
        {
            supplier = "The roastery",
            lines = new[] { new { stockItemId = 999999, quantity = 1m, unitCost = 1m } },
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, unknownItem, "a shelf nobody keeps takes no delivery");

        var (nothing, _) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 2, quantity = 0m, reason = "Nothing at all" });
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, "a movement moves something");

        var (noReason, _) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 2, quantity = 1m, reason = "  " });
        Assert.AreEqual(HttpStatusCode.BadRequest, noReason, "waste is written off with a reason");

        var (sale, _) = await BackOffice.RefusedAsync(HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 1, quantity = 1m, reason = "Not by hand" });
        Assert.AreEqual(HttpStatusCode.BadRequest, sale, "a sale comes off the shelf through a recipe, not the back office");

    }

    [TestMethod]
    public async Task The_storeroom_is_the_back_offices()
    {
        var id = await AnItemAsync();

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Url("/levels"), null),
            (HttpMethod.Get, Url("/items"), null),
            (HttpMethod.Post, Url("/items"), new { name = new { en = "Not mine" }, unit = "kg", autoSoldOut = false }),
            (HttpMethod.Post, Url("/movements"), new { stockItemId = id, type = 2, quantity = 1m, reason = "No" }),
        })
        {
            foreach (var persona in new[] { Persona.Cashier(Suite.Branch), Persona.Customer() })
            {
                var (status, _) = await Suite.Inventory.As(persona, Suite.Branch).RefusedAsync(method, path, body);
                Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path} for {persona.Name}");
            }
        }

        using var nobody = Suite.Inventory.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Url("/levels"))).StatusCode);

        // The owner is back office too
        await Owner.GetAsync<List<LevelView>>(Url("/levels"));
    }
}

/// <summary>A recipe and what it costs, as the menu screens read them.</summary>
public record RecipeView(int CatalogItemId, List<RecipeLineView> Lines);
public record RecipeLineView(int StockItemId, decimal Quantity);
public record RecipeCostView(int CatalogItemId, decimal BaseCost, List<int> Uncosted);
