using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class MenuWriteToolsTests
{
    private static MenuWriteTools Tools(Bench bench)
    {
        var signer = new DraftSigner(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = "k" }), bench.Clock, NullLogger<DraftSigner>.Instance);
        return new MenuWriteTools(bench.Tenant, bench.Api, new WriteFlow(bench.Audit, bench.Accessor, signer, new WriteLimiter(bench.Clock)));
    }

    /// <summary>A café with Hot drinks, coffee beans and milk on the shelf, and assistants that answer</summary>
    private static Bench Cafe()
    {
        var bench = new Bench().WithTenant();
        var h = bench.Handler;
        h.OnJson("GET", "catalog-api/api/catalog/categories", _ => new object[] { new { id = 4, name = new { en = "Hot drinks", ar = "مشروبات ساخنة" }, displayOrder = 1 } });
        h.OnJson("POST", "catalog-api/api/catalog/assist/localize", _ => new { name = new { en = "Spanish Latte", ar = "سبانش لاتيه" }, description = (object?)null, filled = new[] { "name.ar" }, warnings = Array.Empty<string>() });
        h.OnJson("GET", "inventory-api/api/inventory/items", _ => new object[]
        {
            new { id = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", isActive = true },
            new { id = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", isActive = true },
        });
        // The proposer answers with the option references it was given: 900000002 is Large
        h.OnJson("POST", "inventory-api/api/inventory/recipes/assist/propose", _ => new
        {
            newItems = new[] { new { key = "condensed-milk", name = new { en = "Condensed Milk", ar = "لبن مكثف" }, unit = "ml", packSize = 397, packName = (object?)null, autoSoldOut = false } },
            recipes = new[]
            {
                new
                {
                    catalogItemId = 999999999, kind = "recipe", warnings = Array.Empty<string>(),
                    lines = new object[]
                    {
                        new { stockItemId = 11, newItemKey = (string?)null, quantity = 18, optionIds = Array.Empty<int>(), slot = 1, none = false },
                        new { stockItemId = 12, newItemKey = (string?)null, quantity = 200, optionIds = Array.Empty<int>(), slot = 2, none = false },
                        new { stockItemId = 12, newItemKey = (string?)null, quantity = 300, optionIds = new[] { 900000002 }, slot = 2, none = false },
                        new { stockItemId = (int?)null, newItemKey = "condensed-milk", quantity = 30, optionIds = Array.Empty<int>(), slot = 3, none = false },
                    },
                },
            },
            warnings = Array.Empty<string>(),
        });
        return bench;
    }

    private static List<MenuWriteTools.GroupInput> Sizes =>
        [new("Size", [new("Regular", 0, true), new("Large", 15)], Required: true)];

    [TestMethod]
    public async Task The_preview_shows_the_dish_its_choices_and_recipe_and_writes_nothing()
    {
        var bench = Cafe();
        var result = await Tools(bench).CreateMenuItem("Spanish Latte", 85, "hot drinks", customizations: Sizes, recipe: "18 g beans, 200 ml milk, 30 ml condensed; large 300 ml milk", requestId: "r1");

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        var preview = json.GetProperty("preview").GetString()!;
        StringAssert.Contains(preview, "Spanish Latte / سبانش لاتيه");
        StringAssert.Contains(preview, "\"Hot drinks / مشروبات ساخنة\"");
        StringAssert.Contains(preview, "Large +15");
        StringAssert.Contains(preview, "Large: Milk 300 ml");
        StringAssert.Contains(preview, "Condensed Milk 30 ml");
        StringAssert.Contains(preview, "New stock items: Condensed Milk / لبن مكثف (in ml)");
        Assert.IsFalse(string.IsNullOrEmpty(json.GetProperty("draft").GetString()));

        var propose = bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/assist/propose"));
        using var body = JsonDocument.Parse(propose.Body!);
        var item = body.RootElement.GetProperty("items")[0];
        StringAssert.Contains(item.GetProperty("brief").GetString(), "condensed", "the owner's words go to the proposer");
        Assert.AreEqual(900000002, item.GetProperty("options")[1].GetProperty("id").GetInt32());
        Assert.IsFalse(bench.Handler.Requests.Any(r => r.Method == HttpMethod.Post && (r.Url.AbsolutePath.EndsWith("/compose") || r.Url.AbsolutePath == "/api/inventory/items")), "nothing is made by a preview");
    }

    [TestMethod]
    public async Task The_confirm_makes_the_dish_then_the_new_stock_then_the_recipe_with_the_real_option_ids()
    {
        var bench = Cafe();
        var tools = Tools(bench);
        var preview = Bench.JsonOf(await tools.CreateMenuItem("Spanish Latte", 85, "Hot drinks", customizations: Sizes, recipe: "auto", requestId: "r1"));
        var draft = preview.GetProperty("draft").GetString();

        bench.Handler.OnJson("POST", "catalog-api/api/catalog/items/compose", _ => new { itemId = 70, catalogTypeId = 4, options = new[] { new { @ref = 900000001, id = 501 }, new { @ref = 900000002, id = 502 } } });
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/items", _ => new { id = 33 });
        bench.Handler.On("PUT", "inventory-api/api/inventory/recipes/70", _ => FakeHandler.Json(new { }));

        var result = await tools.CreateMenuItem("Spanish Latte", 85, "Hot drinks", customizations: Sizes, requestId: "r1", confirm: true, draft: draft);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.IsTrue(Bench.JsonOf(result).GetProperty("done").GetBoolean(), Bench.TextOf(result));
        var compose = bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/compose"));
        Assert.IsNotNull(compose.RequestId, "the dish is made under its own idempotency key");
        using (var c = JsonDocument.Parse(compose.Body!))
        {
            Assert.AreEqual(4, c.RootElement.GetProperty("catalogTypeId").GetInt32());
            Assert.AreEqual("سبانش لاتيه", c.RootElement.GetProperty("name").GetProperty("ar").GetString());
        }

        var recipe = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put);
        using var doc = JsonDocument.Parse(recipe.Body!);
        var lines = doc.RootElement.GetProperty("lines").EnumerateArray().ToList();
        Assert.HasCount(4, lines);
        Assert.AreEqual(502, lines[2].GetProperty("optionIds")[0].GetInt32(), "the large's reference became its real id");
        Assert.AreEqual(33, lines[3].GetProperty("stockItemId").GetInt32(), "the new stock item's id");
    }

    [TestMethod]
    public async Task A_confirm_with_a_changed_draft_makes_nothing()
    {
        var bench = Cafe();
        var tools = Tools(bench);
        var draft = Bench.JsonOf(await tools.CreateMenuItem("Spanish Latte", 85, "Hot drinks", requestId: "r1")).GetProperty("draft").GetString()!;

        var result = await tools.CreateMenuItem("Spanish Latte", 85, "Hot drinks", requestId: "r2", confirm: true, draft: draft);

        Assert.IsTrue(result.IsError);
        Assert.IsFalse(bench.Handler.Requests.Any(r => r.Url.AbsolutePath.EndsWith("/compose")));
    }

    [TestMethod]
    public void A_new_category_is_named_on_the_side_of_its_script()
    {
        var (existing, fresh) = MenuWriteTools.PickCategory([], "مشروبات باردة");
        Assert.IsNull(existing);
        Assert.AreEqual("مشروبات باردة", fresh!.Ar);
        Assert.IsNull(fresh.En);
    }
}
