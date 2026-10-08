using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class StockWriteToolsTests
{
    private static StockWriteTools Tools(Bench bench)
    {
        var signer = new DraftSigner(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = "k" }), bench.Clock, NullLogger<DraftSigner>.Instance);
        return new StockWriteTools(bench.Tenant, bench.Api, new WriteFlow(bench.Audit, bench.Accessor, signer, new WriteLimiter(bench.Clock)));
    }

    /// <summary>Beans in grams and milk in ml on the shelf of every branch; Abu Auf on the books</summary>
    private static Bench Storeroom()
    {
        var bench = new Bench().WithTenant();
        var h = bench.Handler;
        h.OnJson("GET", "inventory-api/api/inventory/levels", _ => new object[]
        {
            new { stockItemId = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", isActive = true, onHand = 5000, reorderLevel = 1000, avgUnitCost = 0.6, isLow = false, value = 3000 },
            new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", isActive = true, onHand = 4000, reorderLevel = (decimal?)null, avgUnitCost = 0.035, isLow = false, value = 140 },
        });
        h.OnJson("GET", "inventory-api/api/inventory/items", _ => new object[]
        {
            new { id = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", packSize = 1000, packName = new { en = "bag" }, autoSoldOut = true, isActive = true },
            new { id = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", packSize = 1000, autoSoldOut = false, isActive = true },
            new { id = 13, name = new { en = "Hazelnut syrup", ar = "بندق" }, unit = "ml", autoSoldOut = false, isActive = false },
        });
        h.OnJson("GET", "finance-api/api/finance/suppliers", _ => new object[] { new { id = 3, name = "Abu Auf", isActive = true, balance = 0 } });
        return bench;
    }

    private static bool Wrote(Bench bench) => bench.Handler.Requests.Any(r => r.Method != HttpMethod.Get);

    private static JsonElement BodyOf(SeenRequest request) => JsonDocument.Parse(request.Body!).RootElement;

    private static string Key(string tool, string requestId, string step) => WriteTools.IdempotencyKey("owner-1", tool, $"{requestId}|{step}").ToString();

    // --- stock items -----------------------------------------------------------

    [TestMethod]
    public async Task A_new_stock_item_is_previewed_then_posted_under_its_key()
    {
        var bench = Storeroom();
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/items", _ => new { id = 40 });
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.CreateStockItem("Oat milk", "ml", nameAr: "لبن شوفان", packSize: 1000, packName: "carton", autoSoldOut: true, requestId: "i1")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "\"Oat milk / لبن شوفان\", counted in ml, bought in packs of 1000 ml (carton)");
        StringAssert.Contains(text, "sell out when it runs out");
        Assert.IsFalse(Wrote(bench));

        var done = Bench.JsonOf(await tools.CreateStockItem("Oat milk", "ml", nameAr: "لبن شوفان", packSize: 1000, packName: "carton", autoSoldOut: true, requestId: "i1", confirm: true));
        Assert.AreEqual(40, done.GetProperty("stockItemId").GetInt32());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual(Key(StockWriteTools.CreateTool, "i1", "item"), post.RequestId);
        var body = BodyOf(post);
        Assert.AreEqual("لبن شوفان", body.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual("ml", body.GetProperty("unit").GetString());
        Assert.AreEqual(1000m, body.GetProperty("packSize").GetDecimal());
        Assert.IsTrue(body.GetProperty("autoSoldOut").GetBoolean());

        Assert.IsTrue((await tools.CreateStockItem("milk", "ml")).IsError, "already on the shelf");
        StringAssert.Contains(Bench.TextOf(await tools.CreateStockItem("Hazelnut syrup", "ml")), "active=true brings it back");
        Assert.IsTrue((await tools.CreateStockItem("Sugar", "kg")).IsError, "counted in g, ml or pcs");
    }

    [TestMethod]
    public async Task Retiring_a_stock_item_puts_it_whole_with_active_false()
    {
        var bench = Storeroom();
        bench.Handler.On("PUT", "inventory-api/api/inventory/items/12", _ => FakeHandler.Json(new { }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.UpdateStockItem("لبن", active: false)).GetProperty("preview").GetString(), "retired: it leaves the lists, its history stays");
        Assert.IsFalse(Wrote(bench));

        await tools.UpdateStockItem("milk", active: false, requestId: "u1", confirm: true);
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put));
        Assert.IsFalse(body.GetProperty("isActive").GetBoolean());
        Assert.AreEqual("Milk", body.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual("ml", body.GetProperty("unit").GetString());
        Assert.AreEqual(1000m, body.GetProperty("packSize").GetDecimal());
    }

    [TestMethod]
    public async Task A_reorder_level_in_kilos_is_set_in_grams_at_the_branch()
    {
        var bench = Storeroom();
        bench.Handler.On("PUT", "inventory-api/api/inventory/items/11/reorder-level", _ => FakeHandler.Json(new { }));
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.SetReorderLevel("beans", 2, "kg", "Maadi")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "At Maadi / المعادي, show \"Coffee beans / بن\" as low at 2000 g or below (now 5000 g on hand, warning at 1000 g)");
        Assert.IsFalse(Wrote(bench));

        await tools.SetReorderLevel("beans", 2, "kg", "Maadi", requestId: "l1", confirm: true);
        var put = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put);
        Assert.AreEqual("2", put.Branch);
        Assert.AreEqual(2000m, BodyOf(put).GetProperty("reorderLevel").GetDecimal());
    }

    // --- the ledger ------------------------------------------------------------

    [TestMethod]
    public async Task Waste_is_a_movement_of_type_waste_with_its_reason_and_key()
    {
        var bench = Storeroom();
        bench.Handler.On("POST", "inventory-api/api/inventory/movements", _ => FakeHandler.Json(new { }));
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.RecordWaste("milk", 2, "went off", "l", "Nasr City")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Record 2000 ml of \"Milk / لبن\" thrown away at Nasr City / مدينة نصر, because \"went off\" (about EGP 70)");
        StringAssert.Contains(text, "On hand goes from 4000 ml to 2000 ml");
        Assert.IsFalse(Wrote(bench));

        await tools.RecordWaste("milk", 2, "went off", "l", "Nasr City", requestId: "w1", confirm: true);
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("1", post.Branch);
        Assert.AreEqual(Key(StockWriteTools.WasteTool, "w1", "movement"), post.RequestId);
        var body = BodyOf(post);
        Assert.AreEqual(StockWriteTools.Waste, body.GetProperty("type").GetInt32());
        Assert.AreEqual(12, body.GetProperty("stockItemId").GetInt32());
        Assert.AreEqual(2000m, body.GetProperty("quantity").GetDecimal());
        Assert.AreEqual("went off", body.GetProperty("reason").GetString());
    }

    [TestMethod]
    public async Task An_adjustment_takes_off_or_adds_with_its_sign_and_refuses_the_wrong_kind_of_unit()
    {
        var bench = Storeroom();
        bench.Handler.On("POST", "inventory-api/api/inventory/movements", _ => FakeHandler.Json(new { }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.AdjustStock("beans", -500, "keying error", branch: "1")).GetProperty("preview").GetString(), "Take off 500 g of \"Coffee beans / بن\"");
        Assert.IsFalse(Wrote(bench));
        Assert.IsTrue((await tools.AdjustStock("beans", 1, "opening", unit: "l", branch: "1")).IsError, "beans are not counted in litres");

        await tools.AdjustStock("beans", -500, "keying error", branch: "1", requestId: "a1", confirm: true);
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post));
        Assert.AreEqual(StockWriteTools.Adjustment, body.GetProperty("type").GetInt32());
        Assert.AreEqual(-500m, body.GetProperty("quantity").GetDecimal());
    }

    [TestMethod]
    public async Task A_delivery_matches_its_lines_and_supplier_and_posts_base_units_and_unit_costs()
    {
        var bench = Storeroom();
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/purchases", _ => new { id = 501 });
        var tools = Tools(bench);
        List<StockWriteTools.PurchaseLine> lines = [new("beans", 10, UnitCost: 600, Unit: "kg"), new("لبن", 20, Total: 700, Unit: "l")];

        var preview = Bench.JsonOf(await tools.RecordPurchase(lines, "abu auf", "4471", "Maadi", requestId: "p1"));
        var text = preview.GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Receive at Maadi / المعادي from Abu Auf, invoice 4471, EGP 6700 in all");
        StringAssert.Contains(text, "- Coffee beans / بن: 10 kg = 10000 g, EGP 6000 (600 per kg)");
        StringAssert.Contains(text, "- Milk / لبن: 20 l = 20000 ml, EGP 700");
        Assert.AreEqual(0, preview.GetProperty("warnings").GetArrayLength());
        Assert.IsFalse(Wrote(bench));

        var done = Bench.JsonOf(await tools.RecordPurchase(lines, "abu auf", "4471", "Maadi", requestId: "p1", confirm: true));
        Assert.AreEqual(501, done.GetProperty("purchaseId").GetInt32());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("2", post.Branch);
        Assert.AreEqual(Key(StockWriteTools.PurchaseTool, "p1", "purchase"), post.RequestId);
        var body = BodyOf(post);
        Assert.AreEqual(3, body.GetProperty("supplierId").GetInt32());
        Assert.AreEqual("Abu Auf", body.GetProperty("supplier").GetString());
        Assert.AreEqual(10000m, body.GetProperty("lines")[0].GetProperty("quantity").GetDecimal());
        Assert.AreEqual(0.6m, body.GetProperty("lines")[0].GetProperty("unitCost").GetDecimal());
        Assert.AreEqual(0.035m, body.GetProperty("lines")[1].GetProperty("unitCost").GetDecimal());
    }

    [TestMethod]
    public async Task A_delivery_from_a_name_not_on_the_books_goes_by_that_name_and_a_repeat_says_so()
    {
        var bench = Storeroom();
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/purchases", _ => new { id = 0 });
        var tools = Tools(bench);
        List<StockWriteTools.PurchaseLine> lines = [new("milk", 10000, UnitCost: 0.035m)];

        var preview = Bench.JsonOf(await tools.RecordPurchase(lines, "Corner shop", branch: "1"));
        StringAssert.Contains(preview.GetProperty("warnings")[0].GetString(), "not a supplier on the books");
        Assert.IsTrue((await tools.RecordPurchase([new("milk", 1)], branch: "1")).IsError, "a line needs its price");
        Assert.IsTrue((await tools.RecordPurchase([new("saffron", 1, 5)], branch: "1")).IsError, "not on the shelf");

        var done = Bench.JsonOf(await tools.RecordPurchase(lines, "Corner shop", branch: "1", requestId: "p2", confirm: true));
        StringAssert.Contains(done.GetProperty("note").GetString(), "already been recorded");
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post));
        Assert.AreEqual(JsonValueKind.Null, body.GetProperty("supplierId").ValueKind);
        Assert.AreEqual("Corner shop", body.GetProperty("supplier").GetString());
    }

    [TestMethod]
    public async Task A_count_shows_the_differences_then_posts_what_was_found()
    {
        var bench = Storeroom();
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/counts", _ => new { id = 77 });
        var tools = Tools(bench);
        List<StockWriteTools.StockLine> lines = [new("beans", 4.5m, "kg"), new("milk", 4000)];

        var text = Bench.JsonOf(await tools.RecordStockCount(lines, "night count", "Nasr")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "- Coffee beans / بن: counted 4500 g, the books say 5000 g (-500 g)");
        StringAssert.Contains(text, "- Milk / لبن: counted 4000 ml, the books say 4000 ml (no difference)");
        Assert.IsFalse(Wrote(bench));

        await tools.RecordStockCount(lines, "night count", "Nasr", requestId: "c1", confirm: true);
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("1", post.Branch);
        Assert.AreEqual(Key(StockWriteTools.CountTool, "c1", "count"), post.RequestId);
        var body = BodyOf(post);
        Assert.AreEqual("night count", body.GetProperty("note").GetString());
        Assert.AreEqual(4500m, body.GetProperty("lines")[0].GetProperty("counted").GetDecimal());
    }

    [TestMethod]
    public async Task A_transfer_goes_from_the_other_branch_to_the_one_named()
    {
        var bench = Storeroom();
        bench.Handler.OnJson("POST", "inventory-api/api/inventory/transfers/to/2", _ => new { id = 9 });
        var tools = Tools(bench);
        List<StockWriteTools.StockLine> lines = [new("beans", 2, "kg")];

        var text = Bench.JsonOf(await tools.TransferStock("Maadi", lines, requestId: "t1")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Send from Nasr City / مدينة نصر to Maadi / المعادي");
        StringAssert.Contains(text, "- Coffee beans / بن: 2000 g");
        Assert.IsFalse(Wrote(bench));
        Assert.IsTrue((await tools.TransferStock("Maadi", lines, from: "Maadi")).IsError, "a branch cannot send to itself");
        Assert.IsTrue((await tools.TransferStock("Zamalek", lines, from: "1")).IsError, "an inactive branch receives nothing");

        var done = Bench.JsonOf(await tools.TransferStock("Maadi", lines, requestId: "t1", confirm: true));
        Assert.AreEqual(9, done.GetProperty("transferId").GetInt32());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("1", post.Branch, "the sending branch is the header");
        Assert.AreEqual(Key(StockWriteTools.TransferTool, "t1", "transfer"), post.RequestId);
        Assert.AreEqual(2000m, BodyOf(post).GetProperty("lines")[0].GetProperty("quantity").GetDecimal());
    }

    [TestMethod]
    public void Units_convert_within_their_kind_only()
    {
        Assert.AreEqual(1000m, StockWriteTools.Factor("kg", "g").Factor);
        Assert.AreEqual(1000m, StockWriteTools.Factor("litres", "ml").Factor);
        Assert.AreEqual(1m, StockWriteTools.Factor(null, "pcs").Factor);
        Assert.IsNotNull(StockWriteTools.Factor("kg", "ml").Error);
        Assert.IsNotNull(StockWriteTools.Factor("cups", "pcs").Error);
        Assert.AreEqual("g", StockWriteTools.BaseUnit("grams"));
        Assert.IsNull(StockWriteTools.BaseUnit("kg"));
    }
}
