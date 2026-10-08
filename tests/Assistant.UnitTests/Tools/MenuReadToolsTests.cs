using System.Net;
using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class MenuReadToolsTests
{
    private static object Item(int id, string en, string ar, decimal price, int typeId, string typeEn, string typeAr,
        bool available = true, bool outOfStock = false, bool onOffer = false, decimal? offerPrice = null, int? weekdays = null,
        decimal? chainPrice = null, object[]? groups = null) => new
    {
        id,
        name = new { en, ar },
        description = new { en = $"{en} as we make it", ar = "" },
        price,
        catalogTypeId = typeId,
        catalogTypeName = new { en = typeEn, ar = typeAr },
        isAvailable = available,
        isOutOfStock = outOfStock,
        isOnOffer = onOffer,
        offerPrice,
        effectivePrice = onOffer && offerPrice is { } o ? o : price,
        offerWeekdays = weekdays,
        offerFrom = weekdays is null ? null : "14:00",
        offerTo = weekdays is null ? null : "17:00",
        isPopular = id == 1,
        preparationTimeMinutes = 5,
        displayOrder = id,
        customizations = groups ?? [],
        @base = new { price = chainPrice ?? price, offerPrice, isOnOffer = onOffer, isAvailable = true },
    };

    private static readonly object[] LatteGroups =
    [
        new
        {
            id = 7, name = new { en = "Size", ar = "الحجم" }, isRequired = true, allowMultiple = false, displayOrder = 1,
            options = new object[]
            {
                new { id = 71, name = new { en = "Regular", ar = "عادي" }, priceAdjustment = 0, isDefault = true, displayOrder = 1, isOutOfStock = false },
                new { id = 72, name = new { en = "Large", ar = "كبير" }, priceAdjustment = 15, isDefault = false, displayOrder = 2, isOutOfStock = false },
            },
        },
    ];

    /// <summary>A latte (popular, on offer Thursday and Friday afternoons) and a croissant; at Maadi the latte is out of stock and dearer.</summary>
    private static Bench Cafe()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/items", r => r.Headers.GetValues("X-Branch-Id").First() == "2"
            ? new[]
            {
                Item(1, "Latte", "لاتيه", 70, 4, "Hot drinks", "مشروبات ساخنة", available: false, outOfStock: true, onOffer: false, offerPrice: 55, weekdays: 0b0110000, chainPrice: 65, groups: LatteGroups),
                Item(2, "Croissant", "كرواسون", 40, 5, "Bakery", "مخبوزات"),
            }
            : new[]
            {
                Item(1, "Latte", "لاتيه", 65, 4, "Hot drinks", "مشروبات ساخنة", onOffer: true, offerPrice: 55, weekdays: 0b0110000, groups: LatteGroups),
                Item(2, "Croissant", "كرواسون", 40, 5, "Bakery", "مخبوزات"),
            });
        return bench;
    }

    private static MenuReadTools Tools(Bench bench) => new(bench.Tenant, bench.Api, bench.Clock);

    [TestMethod]
    public async Task The_menu_reads_every_branch_and_says_where_an_item_is_out_or_priced_differently()
    {
        var bench = Cafe();

        var result = await Tools(bench).GetMenu(null, null, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var calls = bench.Handler.Requests.Where(q => q.Url.Host == "catalog-api").ToList();
        CollectionAssert.AreEquivalent(new[] { "1", "2" }, calls.Select(c => c.Branch).ToList());
        StringAssert.Contains(calls[0].Url.Query, "api-version=1.0");

        var json = Bench.JsonOf(result);
        Assert.AreEqual(2, json.GetProperty("items").GetInt32());
        Assert.AreEqual(1, json.GetProperty("soldOutSomewhere").GetInt32());
        var categories = json.GetProperty("categories").EnumerateArray().ToList();
        Assert.AreEqual("Hot drinks", categories[0].GetProperty("category").GetString());
        Assert.AreEqual("مشروبات ساخنة", categories[0].GetProperty("categoryAr").GetString());
        var latte = categories[0].GetProperty("items")[0];
        Assert.AreEqual("لاتيه", latte.GetProperty("nameAr").GetString());
        Assert.AreEqual(65m, latte.GetProperty("price").GetDecimal());
        Assert.AreEqual("Maadi / المعادي", latte.GetProperty("outOfStockAt")[0].GetString());
        Assert.AreEqual(70m, latte.GetProperty("branchPrices")[0].GetProperty("price").GetDecimal());
        Assert.AreEqual("Size (2, required)", latte.GetProperty("choices")[0].GetString());
        var offer = latte.GetProperty("offer");
        Assert.AreEqual(55m, offer.GetProperty("price").GetDecimal());
        Assert.AreEqual("Thu, Fri", offer.GetProperty("days").GetString());
        Assert.AreEqual(1, offer.GetProperty("liveNowAt").GetArrayLength(), "live at Nasr City only");
        var croissant = categories[1].GetProperty("items")[0];
        Assert.IsFalse(croissant.TryGetProperty("offer", out _));
        Assert.IsFalse(croissant.TryGetProperty("outOfStockAt", out _));
    }

    [TestMethod]
    public async Task A_category_named_in_Arabic_keeps_only_its_items_and_an_unknown_one_says_so()
    {
        var bench = Cafe();

        var json = Bench.JsonOf(await Tools(bench).GetMenu("مخبوزات", "maadi", CancellationToken.None));
        Assert.AreEqual(1, json.GetProperty("items").GetInt32());
        Assert.AreEqual("Croissant", json.GetProperty("categories")[0].GetProperty("items")[0].GetProperty("name").GetString());
        Assert.IsTrue(bench.Handler.Requests.Where(q => q.Url.Host == "catalog-api").All(q => q.Branch == "2"));

        var bad = await Tools(bench).GetMenu("Desserts", null, CancellationToken.None);
        Assert.IsTrue(bad.IsError);
        StringAssert.Contains(Bench.TextOf(bad), "No category matches 'Desserts'");
    }

    [TestMethod]
    public async Task One_item_comes_with_its_options_and_its_recipe_costed_at_the_branch()
    {
        var bench = Cafe();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/recipes/costs", _ => new[]
        {
            new
            {
                catalogItemId = 1, baseCost = 19.5m, uncosted = Array.Empty<int>(),
                lines = new object[]
                {
                    new { stockItemId = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", quantity = 18, optionIds = Array.Empty<int>(), unitCost = 0.5m, cost = 9m, slot = 1, isNone = false },
                    new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 200, optionIds = Array.Empty<int>(), unitCost = 0.0525m, cost = 10.5m, slot = 2, isNone = false },
                    new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 300, optionIds = new[] { 72 }, unitCost = 0.0525m, cost = 15.75m, slot = 2, isNone = false },
                },
            },
        });

        var result = await Tools(bench).GetMenuItem("latte", "Nasr City", CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var costCall = bench.Handler.Requests.Single(q => q.Url.Host == "inventory-api");
        Assert.AreEqual("/api/inventory/recipes/costs", costCall.Url.AbsolutePath);
        Assert.AreEqual("1", costCall.Branch);
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("id").GetInt32());
        var large = json.GetProperty("customizations")[0].GetProperty("options")[1];
        Assert.AreEqual("Large", large.GetProperty("option").GetString());
        Assert.AreEqual("كبير", large.GetProperty("optionAr").GetString());
        Assert.AreEqual(15m, large.GetProperty("adds").GetDecimal());
        var recipe = json.GetProperty("recipe");
        Assert.AreEqual(19.5m, recipe.GetProperty("baseCost").GetDecimal());
        Assert.AreEqual(45.5m, recipe.GetProperty("margin").GetDecimal());
        Assert.AreEqual(30m, recipe.GetProperty("foodCostPercent").GetDecimal());
        var lines = recipe.GetProperty("lines").EnumerateArray().ToList();
        Assert.AreEqual(3, lines.Count);
        Assert.IsFalse(lines[1].TryGetProperty("for", out _), "the slot's default line is for no option");
        Assert.AreEqual("Large / كبير", lines[2].GetProperty("for").GetString());
    }

    [TestMethod]
    public async Task Without_inventory_in_the_plan_the_item_still_answers_and_says_why_there_is_no_recipe()
    {
        var bench = Cafe();
        bench.Handler.On("GET", "inventory-api/api/inventory/recipes/costs", _ => new HttpResponseMessage(HttpStatusCode.PaymentRequired));

        var result = await Tools(bench).GetMenuItem("Croissant", null, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        StringAssert.Contains(Bench.JsonOf(result).GetProperty("recipe").GetProperty("note").GetString(), "not included in this business's plan");
    }

    [TestMethod]
    public async Task Recipes_are_named_from_the_menu_and_the_untracked_items_are_listed()
    {
        var bench = Cafe();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/recipes", _ => new[]
        {
            new
            {
                catalogItemId = 1,
                lines = new object[]
                {
                    new { id = 1, stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 200, optionIds = Array.Empty<int>(), slot = 2, isNone = false },
                    new { id = 2, stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 300, optionIds = new[] { 72 }, slot = 2, isNone = false },
                },
            },
        });

        var result = await Tools(bench).GetRecipes(null, null, 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var recipesCall = bench.Handler.Requests.Single(q => q.Url.Host == "inventory-api");
        Assert.AreEqual("/api/inventory/recipes", recipesCall.Url.AbsolutePath);
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("tracked").GetInt32());
        Assert.AreEqual("Croissant", json.GetProperty("notTrackedItems")[0].GetProperty("name").GetString());
        var latte = json.GetProperty("recipes")[0];
        Assert.AreEqual("Latte", latte.GetProperty("item").GetString());
        Assert.AreEqual("Large / كبير", latte.GetProperty("lines")[1].GetProperty("for").GetString());
    }

    [TestMethod]
    public async Task Food_cost_puts_the_worst_margin_first_per_branch()
    {
        var bench = Cafe();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/recipes/costs", _ => new object[]
        {
            new { catalogItemId = 1, baseCost = 19.5m, lines = Array.Empty<object>(), uncosted = Array.Empty<int>() },
            new { catalogItemId = 2, baseCost = 20m, lines = Array.Empty<object>(), uncosted = new[] { 99 } },
        });

        var result = await Tools(bench).GetFoodCost(null, "1", 15, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.IsTrue(bench.Handler.Requests.Where(q => q.Url.Host is "inventory-api" or "catalog-api").All(q => q.Branch == "1"));
        var branch = Bench.JsonOf(result).GetProperty("branches")[0];
        Assert.AreEqual(2, branch.GetProperty("tracked").GetInt32());
        var worst = branch.GetProperty("worstFirst").EnumerateArray().ToList();
        Assert.AreEqual("Croissant", worst[0].GetProperty("item").GetString());
        Assert.AreEqual(50m, worst[0].GetProperty("foodCostPercent").GetDecimal());
        Assert.IsTrue(worst[0].GetProperty("costIncomplete").GetBoolean());
        Assert.AreEqual(35.5m, worst[1].GetProperty("offerMargin").GetDecimal(), "the latte is on offer at 55 here");
        Assert.AreEqual(40m, branch.GetProperty("averageFoodCostPercent").GetDecimal());
    }

    [TestMethod]
    public async Task Promo_codes_say_how_often_they_were_used_and_whether_they_work_now()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/promos", _ => new object[]
        {
            new { id = 3, code = "SUMMER10", kind = 0, value = 10m, minSubtotal = 100m, startsAt = (DateTime?)null, endsAt = (DateTime?)null, maxUses = 50, oncePerCustomer = true, isActive = true, uses = 12 },
            new { id = 2, code = "WELCOME", kind = 1, value = 20m, minSubtotal = (decimal?)null, startsAt = (DateTime?)null, endsAt = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), maxUses = (int?)null, oncePerCustomer = true, isActive = true, uses = 40 },
            new { id = 1, code = "FULL", kind = "Amount", value = 5m, minSubtotal = (decimal?)null, startsAt = (DateTime?)null, endsAt = (DateTime?)null, maxUses = 5, oncePerCustomer = false, isActive = true, uses = 5 },
        });

        var result = await new MenuReadTools(bench.Tenant, bench.Api, bench.Clock).GetPromoCodes(false, 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var call = bench.Handler.Requests.Single(q => q.Url.Host == "catalog-api");
        Assert.IsNull(call.Branch, "promo codes are the chain's");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1, json.GetProperty("live").GetInt32());
        Assert.AreEqual(57, json.GetProperty("timesUsed").GetInt32());
        var promos = json.GetProperty("promos").EnumerateArray().ToList();
        Assert.AreEqual("10%", promos[0].GetProperty("discount").GetString());
        Assert.AreEqual("live", promos[0].GetProperty("state").GetString());
        Assert.AreEqual(20m, promos[1].GetProperty("discountAmount").GetDecimal());
        Assert.AreEqual("expired", promos[1].GetProperty("state").GetString());
        Assert.AreEqual("used up", promos[2].GetProperty("state").GetString());
    }
}
