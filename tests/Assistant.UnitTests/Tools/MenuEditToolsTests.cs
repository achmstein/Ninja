using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class MenuEditToolsTests
{
    private static MenuEditTools Tools(Bench bench)
    {
        var signer = new DraftSigner(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = "k" }), bench.Clock, NullLogger<DraftSigner>.Instance);
        return new MenuEditTools(bench.Tenant, bench.Api, new WriteFlow(bench.Audit, bench.Accessor, signer, new WriteLimiter(bench.Clock)));
    }

    /// <summary>
    /// A café with a latte (sizes and milks) and a brownie on a Saturday
    /// happy-hour offer. The fake matches by path prefix, so the routes a test
    /// adds under /items/... go in first and the menu list after them.
    /// </summary>
    private static Bench Cafe(Action<FakeHandler>? first = null)
    {
        var bench = new Bench().WithTenant();
        var h = bench.Handler;
        first?.Invoke(h);
        h.OnJson("GET", "catalog-api/api/catalog/items/11/customizations", _ => new object[]
        {
            new { id = 21, name = new { en = "Size", ar = "الحجم" }, isRequired = true, allowMultiple = false, displayOrder = 0, options = new object[]
            {
                new { id = 31, name = new { en = "Regular", ar = "عادي" }, priceAdjustment = 0, isDefault = true, displayOrder = 0 },
                new { id = 32, name = new { en = "Large", ar = "كبير" }, priceAdjustment = 15, isDefault = false, displayOrder = 1 },
            } },
            new { id = 22, name = new { en = "Milk", ar = "اللبن" }, isRequired = false, allowMultiple = false, displayOrder = 1, options = new object[]
            {
                new { id = 41, name = new { en = "Full cream", ar = "كامل الدسم" }, priceAdjustment = 0, isDefault = true, displayOrder = 0 },
            } },
        });
        h.OnJson("GET", "catalog-api/api/catalog/items", _ => new object[]
        {
            new
            {
                id = 11, name = new { en = "Latte", ar = "لاتيه" }, description = new { en = "Espresso and milk", ar = (string?)null }, price = 50, catalogTypeId = 4,
                catalogTypeName = new { en = "Hot drinks", ar = "مشروبات ساخنة" }, isAvailable = true, isOnOffer = false, isPopular = false, preparationTimeMinutes = 4,
                @base = new { price = 50, offerPrice = (decimal?)null, isOnOffer = false, isAvailable = true },
            },
            new
            {
                id = 12, name = new { en = "Brownie", ar = "براوني" }, price = 40, catalogTypeId = 5, catalogTypeName = new { en = "Desserts", ar = "حلويات" },
                isAvailable = true, isOnOffer = true, offerPrice = 30, offerWeekdays = 64, offerFrom = "16:00", offerTo = "19:00", isPopular = true,
                @base = new { price = 40, offerPrice = 30, isOnOffer = true, isAvailable = true, offerWeekdays = 64, offerFrom = "16:00", offerTo = "19:00" },
            },
        });
        h.OnJson("GET", "catalog-api/api/catalog/categories", _ => new object[]
        {
            new { id = 4, name = new { en = "Hot drinks", ar = "مشروبات ساخنة" }, displayOrder = 1 },
            new { id = 5, name = new { en = "Desserts", ar = "حلويات" }, displayOrder = 2 },
        });
        h.OnJson("GET", "catalog-api/api/catalog/promos", _ => new object[]
        {
            new { id = 7, code = "SUMMER", kind = 1, value = 50, minSubtotal = 200, maxUses = (int?)null, oncePerCustomer = true, isActive = true, uses = 3 },
        });
        return bench;
    }

    private static bool Wrote(Bench bench) => bench.Handler.Requests.Any(r => r.Method != HttpMethod.Get && !r.Url.AbsolutePath.Contains("/assist/", StringComparison.Ordinal));

    private static JsonElement BodyOf(SeenRequest request) => JsonDocument.Parse(request.Body!).RootElement;

    // --- update_menu_item ------------------------------------------------------

    [TestMethod]
    public async Task Updating_a_dish_previews_the_changes_then_puts_the_whole_item_keeping_the_rest()
    {
        var bench = Cafe();
        bench.Handler.On("PUT", "catalog-api/api/catalog/items/11", _ => FakeHandler.Json(new { }));
        var tools = Tools(bench);

        var preview = await tools.UpdateMenuItem("لاتيه", price: 55, category: "desserts", requestId: "r1");
        Assert.AreNotEqual(true, preview.IsError, Bench.TextOf(preview));
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Latte / لاتيه");
        StringAssert.Contains(text, "price EGP 50 → 55");
        StringAssert.Contains(text, "\"Hot drinks / مشروبات ساخنة\" → \"Desserts / حلويات\"");
        Assert.IsFalse(Wrote(bench));

        var done = await tools.UpdateMenuItem("11", price: 55, category: "5", requestId: "r1", confirm: true);
        Assert.IsTrue(Bench.JsonOf(done).GetProperty("done").GetBoolean(), Bench.TextOf(done));
        var put = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put);
        Assert.IsNull(put.Branch, "the item is the chain's: no branch header");
        var body = BodyOf(put);
        Assert.AreEqual(55m, body.GetProperty("price").GetDecimal());
        Assert.AreEqual(5, body.GetProperty("catalogTypeId").GetInt32());
        Assert.AreEqual("لاتيه", body.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual("Espresso and milk", body.GetProperty("description").GetProperty("en").GetString());
        Assert.AreEqual(4, body.GetProperty("preparationTimeMinutes").GetInt32());
        Assert.IsTrue(body.GetProperty("isAvailable").GetBoolean());
    }

    [TestMethod]
    public async Task A_price_under_the_running_offer_is_refused()
    {
        var bench = Cafe();
        var result = await Tools(bench).UpdateMenuItem("Brownie", price: 25);
        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "set_item_offer");
        Assert.IsTrue((await Tools(bench).UpdateMenuItem("Latte")).IsError, "nothing to change");
    }

    // --- set_item_offer --------------------------------------------------------

    [TestMethod]
    public async Task An_offer_at_one_branch_patches_with_that_branch_and_its_days_and_hours()
    {
        var bench = Cafe(h => h.OnJson("PATCH", "catalog-api/api/catalog/items/11/offer", _ => new { id = 11, name = new { en = "Latte" }, price = 50, isOnOffer = true }));
        var tools = Tools(bench);

        var preview = Bench.JsonOf(await tools.SetItemOffer("latte", true, 45, days: "fri, sat", hours: "16:00-19:00", branch: "Maadi", requestId: "o1"));
        var text = preview.GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "EGP 45 (usually 50) at Maadi / المعادي only");
        StringAssert.Contains(text, "on Fri, Sat, 16:00-19:00");
        Assert.IsFalse(Wrote(bench));

        await tools.SetItemOffer("latte", true, 45, days: "fri, sat", hours: "16:00-19:00", branch: "Maadi", requestId: "o1", confirm: true);
        var patch = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.AreEqual("2", patch.Branch);
        var body = BodyOf(patch);
        Assert.IsTrue(body.GetProperty("isOnOffer").GetBoolean());
        Assert.AreEqual(45m, body.GetProperty("offerPrice").GetDecimal());
        Assert.AreEqual((1 << 5) | (1 << 6), body.GetProperty("offerWeekdays").GetInt32());
        Assert.AreEqual("19:00", body.GetProperty("offerTo").GetString());

        Assert.IsTrue((await tools.SetItemOffer("latte", true, 50)).IsError, "an offer must be below the price");
    }

    [TestMethod]
    public async Task Ending_an_offer_everywhere_keeps_its_days_and_sends_no_branch()
    {
        var bench = Cafe(h => h.OnJson("PATCH", "catalog-api/api/catalog/items/12/offer", _ => new { id = 12, name = new { en = "Brownie" }, price = 40, isOnOffer = false }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.SetItemOffer("brownie", false)).GetProperty("preview").GetString(), "End the offer on \"Brownie / براوني\" at every branch (now EGP 30)");

        await tools.SetItemOffer("brownie", false, requestId: "o2", confirm: true);
        var patch = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.IsNull(patch.Branch);
        var body = BodyOf(patch);
        Assert.IsFalse(body.GetProperty("isOnOffer").GetBoolean());
        Assert.AreEqual(64, body.GetProperty("offerWeekdays").GetInt32());
        Assert.AreEqual("16:00", body.GetProperty("offerFrom").GetString());
    }

    // --- set_branch_price ------------------------------------------------------

    [TestMethod]
    public async Task A_branch_price_puts_the_override_and_keeps_the_branchs_offer()
    {
        var bench = Cafe(h =>
        {
            h.OnJson("GET", "catalog-api/api/catalog/branches/2/overrides", _ => new object[]
            {
                new { id = 1, branchId = 2, catalogItemId = 11, isAvailable = true, isOutOfStock = false, priceOverride = (decimal?)null, offerPriceOverride = 40, isOnOfferOverride = true },
            });
            h.OnJson("PUT", "catalog-api/api/catalog/branches/2/items/11/override", _ => new { id = 1, branchId = 2, catalogItemId = 11, isAvailable = true, priceOverride = 60 });
        });
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.SetBranchPrice("latte", "maadi", price: 60, requestId: "b1")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "At Maadi / المعادي, \"Latte / لاتيه\": price EGP 50 → 60");
        Assert.IsFalse(Wrote(bench));

        await tools.SetBranchPrice("latte", "maadi", price: 60, requestId: "b1", confirm: true);
        var put = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put);
        Assert.AreEqual("2", put.Branch);
        var body = BodyOf(put);
        Assert.AreEqual(60m, body.GetProperty("priceOverride").GetDecimal());
        Assert.AreEqual(40m, body.GetProperty("offerPriceOverride").GetDecimal());
        Assert.IsTrue(body.GetProperty("isOnOfferOverride").GetBoolean());
        Assert.IsTrue(body.GetProperty("isAvailable").GetBoolean());
    }

    // --- categories ------------------------------------------------------------

    [TestMethod]
    public async Task A_new_category_is_named_in_both_languages_and_made_from_the_signed_draft()
    {
        var bench = Cafe(h =>
        {
            h.OnJson("POST", "catalog-api/api/catalog/assist/localize", _ => new { name = new { en = "Cold drinks", ar = "مشروبات باردة" } });
            h.OnJson("POST", "catalog-api/api/catalog/categories", _ => new { id = 9, name = new { en = "Cold drinks", ar = "مشروبات باردة" }, displayOrder = 3 });
        });
        var tools = Tools(bench);

        var preview = Bench.JsonOf(await tools.CreateCategory("Cold drinks", requestId: "c1"));
        StringAssert.Contains(preview.GetProperty("preview").GetString(), "\"Cold drinks / مشروبات باردة\"");
        var draft = preview.GetProperty("draft").GetString();
        Assert.IsFalse(Wrote(bench));

        Assert.IsTrue((await tools.CreateCategory("Cold drinks", requestId: "c2", confirm: true, draft: draft)).IsError, "a draft is bound to its request");
        var done = Bench.JsonOf(await tools.CreateCategory("Cold drinks", requestId: "c1", confirm: true, draft: draft));
        Assert.AreEqual(9, done.GetProperty("categoryId").GetInt32());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post && r.Url.AbsolutePath == "/api/catalog/categories");
        var body = BodyOf(post);
        Assert.AreEqual("مشروبات باردة", body.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual(3, body.GetProperty("displayOrder").GetInt32(), "last on the menu");

        Assert.IsTrue((await tools.CreateCategory("desserts")).IsError, "one of that name exists");
    }

    [TestMethod]
    public async Task Renaming_a_category_keeps_the_other_name_and_its_place()
    {
        var bench = Cafe(h => h.OnJson("PUT", "catalog-api/api/catalog/categories/4", _ => new { id = 4, name = new { en = "Coffee", ar = "مشروبات ساخنة" }, displayOrder = 1 }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.RenameCategory("hot drinks", name: "Coffee")).GetProperty("preview").GetString(), "to \"Coffee / مشروبات ساخنة\"");
        Assert.IsFalse(Wrote(bench));

        await tools.RenameCategory("مشروبات ساخنة", name: "Coffee", requestId: "n1", confirm: true);
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put));
        Assert.AreEqual("Coffee", body.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual("مشروبات ساخنة", body.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual(1, body.GetProperty("displayOrder").GetInt32());
    }

    // --- customizations --------------------------------------------------------

    [TestMethod]
    public async Task Adding_an_option_sends_every_option_with_its_id_and_the_new_one_without()
    {
        var bench = Cafe(h => h.OnJson("PUT", "catalog-api/api/catalog/items/11/customizations/22", _ => new { id = 22, name = new { en = "Milk" } }));
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.EditCustomization("latte", "milk", "Oat", add: true, newNameAr: "شوفان", price: 15, requestId: "e1")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Add \"Oat / شوفان\" (+EGP 15) to \"Milk / اللبن\"");
        Assert.IsFalse(Wrote(bench));

        await tools.EditCustomization("latte", "milk", "Oat", add: true, newNameAr: "شوفان", price: 15, requestId: "e1", confirm: true);
        var options = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put)).GetProperty("options").EnumerateArray().ToList();
        Assert.HasCount(2, options);
        Assert.AreEqual(41, options[0].GetProperty("id").GetInt32(), "the existing option keeps its id");
        Assert.AreEqual(0, options[1].GetProperty("id").GetInt32());
        Assert.AreEqual(15m, options[1].GetProperty("priceAdjustment").GetDecimal());
        Assert.AreEqual(1, options[1].GetProperty("displayOrder").GetInt32());
    }

    [TestMethod]
    public async Task Changing_an_options_price_keeps_the_others_as_they_are()
    {
        var bench = Cafe(h => h.OnJson("PUT", "catalog-api/api/catalog/items/11/customizations/21", _ => new { id = 21, name = new { en = "Size" } }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.EditCustomization("latte", "size", "large", price: 20)).GetProperty("preview").GetString(), "adds EGP 20 (was 15)");
        await tools.EditCustomization("latte", "الحجم", "كبير", price: 20, requestId: "e2", confirm: true);

        var options = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put)).GetProperty("options").EnumerateArray().ToList();
        Assert.HasCount(2, options);
        Assert.AreEqual(31, options[0].GetProperty("id").GetInt32());
        Assert.AreEqual(0m, options[0].GetProperty("priceAdjustment").GetDecimal());
        Assert.IsTrue(options[0].GetProperty("isDefault").GetBoolean());
        Assert.AreEqual(32, options[1].GetProperty("id").GetInt32());
        Assert.AreEqual(20m, options[1].GetProperty("priceAdjustment").GetDecimal());
        Assert.AreEqual("كبير", options[1].GetProperty("name").GetProperty("ar").GetString());
    }

    [TestMethod]
    public async Task Choices_given_are_added_as_new_groups_and_ones_it_has_are_left_alone()
    {
        var bench = Cafe(h => h.OnJson("POST", "catalog-api/api/catalog/items/11/customizations", _ => new { id = 23, name = new { en = "Sugar" } }));
        var tools = Tools(bench);
        List<MenuWriteTools.GroupInput> groups =
        [
            new("Size", [new("Small", 0)]),
            new("Sugar", [new("None", 0, true), new("Extra", 0)]),
        ];

        var preview = Bench.JsonOf(await tools.AddCustomizations("latte", groups, requestId: "a1"));
        StringAssert.Contains(preview.GetProperty("preview").GetString(), "Choice \"Sugar\" (optional): None (default), Extra");
        StringAssert.Contains(preview.GetProperty("warnings")[0].GetString(), "already has \"Size / الحجم\"");
        Assert.IsFalse(Wrote(bench));

        var done = Bench.JsonOf(await tools.AddCustomizations("latte", requestId: "a1", confirm: true, draft: preview.GetProperty("draft").GetString()));
        Assert.IsTrue(done.GetProperty("done").GetBoolean(), done.ToString());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post && r.Url.AbsolutePath.EndsWith("/customizations"));
        var body = BodyOf(post);
        Assert.AreEqual("Sugar", body.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual(2, body.GetProperty("displayOrder").GetInt32(), "after the dish's own groups");
        Assert.AreEqual(2, body.GetProperty("options").GetArrayLength());
    }

    [TestMethod]
    public async Task Suggested_choices_are_asked_for_with_the_groups_the_dish_has()
    {
        var bench = Cafe(h => h.OnJson("POST", "catalog-api/api/catalog/assist/customizations", _ => new
        {
            groups = new[] { new { name = new { en = "Syrup", ar = "صوص" }, isRequired = false, allowMultiple = true, options = new[] { new { name = new { en = "Vanilla", ar = "فانيليا" }, priceAdjustment = 10, isDefault = false } } } },
            warnings = Array.Empty<string>(),
        }));

        var preview = Bench.JsonOf(await Tools(bench).AddCustomizations("latte", requestId: "a2"));

        StringAssert.Contains(preview.GetProperty("preview").GetString(), "Vanilla / فانيليا +10");
        var ask = BodyOf(bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/assist/customizations")));
        Assert.AreEqual(2, ask.GetProperty("existingGroups").GetArrayLength());
        Assert.IsFalse(Wrote(bench));
    }

    // --- promo codes -----------------------------------------------------------

    [TestMethod]
    public async Task A_promo_code_is_previewed_in_plain_words_then_posted()
    {
        var bench = Cafe(h => h.OnJson("POST", "catalog-api/api/catalog/promos", _ => new { id = 8, code = "WELCOME10", kind = 0, value = 10, oncePerCustomer = true, isActive = true, uses = 0 }));
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.CreatePromoCode("welcome10", "percent", 10, minSubtotal: 100, endsOn: "2026-10-31", requestId: "p1")).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "WELCOME10: 10% off orders of EGP 100 or more, through 2026-10-31, once per customer");
        Assert.IsFalse(Wrote(bench));

        var done = Bench.JsonOf(await tools.CreatePromoCode("welcome10", "percent", 10, minSubtotal: 100, endsOn: "2026-10-31", requestId: "p1", confirm: true));
        Assert.AreEqual(8, done.GetProperty("promoId").GetInt32());
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post));
        Assert.AreEqual("WELCOME10", body.GetProperty("code").GetString());
        Assert.AreEqual(0, body.GetProperty("kind").GetInt32());
        StringAssert.StartsWith(body.GetProperty("endsAt").GetString(), "2026-10-31T", "the end of the 31st in Cairo is late on the 31st in UTC");

        Assert.IsTrue((await tools.CreatePromoCode("BIG", "percent", 150)).IsError);
        Assert.IsTrue((await tools.CreatePromoCode("summer", "amount", 20)).IsError, "the code exists");
    }

    [TestMethod]
    public async Task Changing_a_promo_code_puts_its_whole_rules_keeping_what_was_not_said()
    {
        var bench = Cafe(h => h.OnJson("PUT", "catalog-api/api/catalog/promos/7", _ => new { id = 7, code = "SUMMER", kind = 1, value = 75, oncePerCustomer = true, isActive = true, uses = 3 }));
        var tools = Tools(bench);

        var text = Bench.JsonOf(await tools.UpdatePromoCode("summer", value: 75, minSubtotal: 0)).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "SUMMER: EGP 50 off orders of EGP 200 or more");
        StringAssert.Contains(text, "to SUMMER: EGP 75 off, once per customer");
        Assert.IsFalse(Wrote(bench));

        await tools.UpdatePromoCode("SUMMER", value: 75, minSubtotal: 0, requestId: "p2", confirm: true);
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put));
        Assert.AreEqual(75m, body.GetProperty("value").GetDecimal());
        Assert.AreEqual(JsonValueKind.Null, body.GetProperty("minSubtotal").ValueKind);
        Assert.AreEqual(1, body.GetProperty("kind").GetInt32());
        Assert.IsTrue(body.GetProperty("isActive").GetBoolean());
    }

    [TestMethod]
    public async Task Switching_a_promo_code_off_patches_it()
    {
        var bench = Cafe(h => h.OnJson("PATCH", "catalog-api/api/catalog/promos/7/active", _ => new { id = 7, code = "SUMMER", kind = 1, value = 50, isActive = false, uses = 3 }));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.SetPromoActive("summer", false)).GetProperty("preview").GetString(), "Switch the promo code SUMMER off");
        Assert.IsFalse(Wrote(bench));

        var done = Bench.JsonOf(await tools.SetPromoActive("summer", false, requestId: "p3", confirm: true));
        Assert.IsFalse(done.GetProperty("active").GetBoolean());
        StringAssert.Contains(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Patch).Body, "\"isActive\":false");
        Assert.IsTrue((await tools.SetPromoActive("summer", true)).IsError, "already on");
    }

    // --- set_recipe ------------------------------------------------------------

    [TestMethod]
    public async Task A_recipe_for_a_dish_is_proposed_with_its_real_options_and_set_with_the_new_stock()
    {
        var bench = Cafe(h =>
        {
            h.OnJson("POST", "inventory-api/api/inventory/recipes/assist/propose", _ => new
            {
                newItems = new[] { new { key = "vanilla", name = new { en = "Vanilla syrup", ar = "صوص فانيليا" }, unit = "ml", packSize = 750, autoSoldOut = false } },
                recipes = new[]
                {
                    new
                    {
                        catalogItemId = 11, kind = "recipe", warnings = Array.Empty<string>(),
                        lines = new object[]
                        {
                            new { stockItemId = 12, quantity = 200, optionIds = Array.Empty<int>(), slot = 1, none = false },
                            new { stockItemId = 12, quantity = 300, optionIds = new[] { 32 }, slot = 1, none = false },
                            new { newItemKey = "vanilla", quantity = 15, optionIds = Array.Empty<int>(), slot = 2, none = false },
                        },
                    },
                },
            });
            h.OnJson("POST", "inventory-api/api/inventory/items", _ => new { id = 33 });
            h.On("PUT", "inventory-api/api/inventory/recipes/11", _ => FakeHandler.Json(new { }));
        });
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/items", _ => new object[] { new { id = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", isActive = true } });
        var tools = Tools(bench);

        var preview = Bench.JsonOf(await tools.SetRecipe("latte", "200 ml milk, large 300, 15 ml vanilla", requestId: "s1"));
        var text = preview.GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Set the stock recipe of \"Latte / لاتيه\"");
        StringAssert.Contains(text, "- Large: Milk 300 ml");
        StringAssert.Contains(text, "New stock items: Vanilla syrup / صوص فانيليا (in ml)");
        var ask = BodyOf(bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/assist/propose"))).GetProperty("items")[0];
        Assert.AreEqual(11, ask.GetProperty("catalogItemId").GetInt32());
        Assert.AreEqual(32, ask.GetProperty("options")[1].GetProperty("id").GetInt32(), "the dish's real option ids");
        StringAssert.Contains(ask.GetProperty("brief").GetString(), "vanilla");
        Assert.IsFalse(Wrote(bench), "a preview makes no stock item and sets no recipe");

        var done = Bench.JsonOf(await tools.SetRecipe("latte", requestId: "s1", confirm: true, draft: preview.GetProperty("draft").GetString()));
        Assert.IsTrue(done.GetProperty("done").GetBoolean(), done.ToString());
        var stock = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post && r.Url.AbsolutePath == "/api/inventory/items");
        Assert.IsNotNull(stock.RequestId, "the new stock item goes under its own idempotency key");
        var lines = BodyOf(bench.Handler.Requests.Single(r => r.Method == HttpMethod.Put)).GetProperty("lines").EnumerateArray().ToList();
        Assert.HasCount(3, lines);
        Assert.AreEqual(32, lines[1].GetProperty("optionIds")[0].GetInt32());
        Assert.AreEqual(33, lines[2].GetProperty("stockItemId").GetInt32());
    }

    [TestMethod]
    public void Days_and_hours_are_read_as_the_owner_says_them()
    {
        Assert.AreEqual((1 << 5) | (1 << 6), MenuEditTools.ParseWeekdays("Friday and Saturday").Mask);
        Assert.IsNull(MenuEditTools.ParseWeekdays("every day").Mask);
        Assert.IsNotNull(MenuEditTools.ParseWeekdays("someday").Error);
        Assert.AreEqual(("16:00", "19:00"), (MenuEditTools.ParseHours("16 to 19").From, MenuEditTools.ParseHours("16 to 19").To));
        Assert.IsNull(MenuEditTools.ParseHours("all day").From);
        Assert.IsNotNull(MenuEditTools.ParseHours("4pm").Error);
    }
}
