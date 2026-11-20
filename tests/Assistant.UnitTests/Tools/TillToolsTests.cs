using System.Text.Json;
using System.Web;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class TillToolsTests
{
    private static TillTools Tools(Bench bench)
    {
        var signer = new DraftSigner(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = "k" }), bench.Clock, NullLogger<DraftSigner>.Instance);
        return new TillTools(bench.Tenant, bench.Api, new WriteFlow(bench.Audit, bench.Accessor, signer, new WriteLimiter(bench.Clock)));
    }

    private static readonly object AhmedHassan = new { id = "u-hassan", firstName = "Ahmed", lastName = "Hassan", enabled = true, phoneNumber = "+201001112233", realmRoles = new[] { "Customer" } };
    private static readonly object AhmedAli = new { id = "u-ali", firstName = "Ahmed", lastName = "Ali", enabled = true, phoneNumber = "+201009998877", realmRoles = new[] { "Customer" } };
    private static readonly object Mona = new { id = "u-mona", firstName = "منى", lastName = "سعيد", enabled = true, phoneNumber = "+201005554444", realmRoles = new[] { "Customer" } };

    /// <summary>
    /// The café at Nasr City (Maadi is quiet): Ahmed Hassan on the bill at
    /// Room 2, whose session he owns; table 4 free; a latte with a must-pick
    /// size and an optional milk. Identity answers by the words searched.
    /// </summary>
    private static Bench Cafe(Action<FakeHandler>? first = null)
    {
        var bench = new Bench().WithTenant();
        var h = bench.Handler;
        first?.Invoke(h);
        h.OnJson("GET", "identity-api/api/identity/users", r =>
        {
            var q = HttpUtility.ParseQueryString(r.RequestUri!.Query)["search"] ?? "";
            return q.ToLowerInvariant() switch
            {
                "ahmed" => new[] { AhmedAli, AhmedHassan },
                "ahmed hassan" => new[] { AhmedHassan },
                "منى" => new[] { Mona },
                _ => Array.Empty<object>(),
            };
        });
        h.On("GET", "sales-api/api/tickets/open", r => FakeHandler.Json(r.Headers.GetValues(NinjaApiClient.BranchHeader).First() == "1"
            ? new object[]
            {
                new { id = 501, type = "Room", locationName = new { en = "Room 2", ar = "غرفة ٢" }, sessionId = 77, placeId = 9, placeKind = "Room", label = "Ahmed Hassan", openedAt = "2026-09-22T10:00:00Z", lineCount = 3, total = 240, customerIds = new[] { "u-hassan" } },
                new { id = 502, type = "Counter", label = "Karim", openedAt = "2026-09-22T11:00:00Z", lineCount = 1, total = 50, customerIds = Array.Empty<string>() },
            }
            : Array.Empty<object>()));
        h.On("GET", "spaces-api/api/stays/open", r => FakeHandler.Json(r.Headers.GetValues(NinjaApiClient.BranchHeader).First() == "1"
            ? new object[]
            {
                new { id = 77, placeId = 9, placeKind = "Room", placeName = new { en = "Room 2", ar = "غرفة ٢" }, customerId = "u-hassan", customerName = "Ahmed Hassan", startedAt = "2026-09-22T10:00:00Z", ticketId = 501, status = "Running", members = new[] { new { customerId = "u-hassan", customerName = "Ahmed Hassan", role = "Owner" } } },
                new { id = 78, placeId = 10, placeKind = "Room", placeName = new { en = "Room 3", ar = "غرفة ٣" }, startedAt = "2026-09-22T11:30:00Z", status = "Running", members = Array.Empty<object>() },
            }
            : Array.Empty<object>()));
        h.On("GET", "spaces-api/api/places", r => FakeHandler.Json(r.Headers.GetValues(NinjaApiClient.BranchHeader).First() == "1"
            ? new object[]
            {
                new { id = 4, kind = 2, name = new { en = "Table 4", ar = "طاولة ٤" }, branchId = 1, isActive = true, isTimed = false, reservable = false },
                new { id = 9, kind = 1, name = new { en = "Room 2", ar = "غرفة ٢" }, branchId = 1, isActive = true, isTimed = true, reservable = true },
            }
            : Array.Empty<object>()));
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
                new { id = 42, name = new { en = "Oat", ar = "شوفان" }, priceAdjustment = 10, isDefault = false, displayOrder = 1 },
            } },
        });
        h.OnJson("GET", "catalog-api/api/catalog/items/12/customizations", _ => Array.Empty<object>());
        h.OnJson("GET", "catalog-api/api/catalog/items", _ => new object[]
        {
            new { id = 11, name = new { en = "Latte", ar = "لاتيه" }, price = 50, catalogTypeId = 4, isAvailable = true, isOnOffer = false, isPopular = false },
            new { id = 12, name = new { en = "Croissant", ar = "كرواسون" }, price = 45, catalogTypeId = 5, isAvailable = true, isOnOffer = false, isPopular = false },
        });
        // Priced as Catalog would: the item plus its options
        h.OnJson("POST", "catalog-api/api/catalog/price-check", r =>
        {
            var body = JsonDocument.Parse(r.Content!.ReadAsStringAsync().Result).RootElement;
            return new
            {
                branchId = body.GetProperty("branchId").GetInt32(),
                lines = body.GetProperty("lines").EnumerateArray().Select(l =>
                {
                    var item = l.GetProperty("itemId").GetInt32();
                    var options = l.TryGetProperty("optionIds", out var o) && o.ValueKind == JsonValueKind.Array ? o.EnumerateArray().Select(x => x.GetInt32()).ToList() : [];
                    var basePrice = item == 11 ? 50m : 45m;
                    var price = basePrice + options.Sum(id => id switch { 32 => 15m, 42 => 10m, _ => 0m });
                    return new { itemId = item, price, basePrice, available = true, outOfStock = false, soldOutOptionIds = Array.Empty<int>() };
                }).ToList(),
            };
        });
        h.OnJson("POST", "ordering-api/api/orders/pos", _ => new { orderId = 9001 });
        return bench;
    }

    private static JsonElement BodyOf(SeenRequest request) => JsonDocument.Parse(request.Body!).RootElement;

    private static bool Ordered(Bench bench) => bench.Handler.Requests.Any(r => r.Url.AbsolutePath.EndsWith("/orders/pos", StringComparison.Ordinal));

    // --- Finding the customer ------------------------------------------------------

    [TestMethod]
    public async Task Of_two_Ahmeds_the_one_here_now_is_picked_and_what_he_owes_is_told()
    {
        var bench = Cafe(h =>
        {
            h.OnJson("GET", "accounts-api/api/accounts/u-hassan", _ => new { customerId = "u-hassan", balance = 120, updatedAt = "2026-09-20T10:00:00Z", transactions = new[] { new { type = "Charge", amount = 120, description = "Receipt 88", source = "posReceipt", sourceNumber = 88, createdAt = "2026-09-20T10:00:00Z" } } });
            h.OnJson("GET", "loyalty-api/api/loyalty/accounts/u-hassan", _ => new { id = 1, userId = "u-hassan", pointsBalance = 340, lifetimePoints = 900, currentTier = "Silver", updatedAt = "2026-09-20T10:00:00Z" });
            h.OnJson("GET", "ordering-api/api/orders/all", _ => new { items = Array.Empty<object>(), totalCount = 0 });
        });

        var json = Bench.JsonOf(await Tools(bench).FindCustomer("Ahmed"));
        Assert.AreEqual("u-hassan", json.GetProperty("match").GetProperty("id").GetString(), json.ToString());
        StringAssert.Contains(json.GetProperty("match").GetProperty("hereNow").GetString(), "Room 2");
        Assert.AreEqual(1, json.GetProperty("others").GetInt32());
        var details = json.GetProperty("details");
        Assert.AreEqual(120m, details.GetProperty("tabBalance").GetDecimal());
        StringAssert.Contains(details.GetProperty("tab").GetString(), "owes EGP 120");
        Assert.AreEqual(340, details.GetProperty("points").GetInt32());
        Assert.AreEqual(240m, details.GetProperty("openBillsTotal").GetDecimal());
    }

    [TestMethod]
    public async Task Both_spellings_are_searched_and_staff_and_switched_off_accounts_are_left_out()
    {
        var bench = Cafe();
        var found = await CustomerFinder.FindAsync(bench.Api, 1, "Mona / منى", CustomerWhereabouts.None, default);
        Assert.AreEqual("u-mona", found.Match?.Id);
        var searches = bench.Handler.Requests.Where(r => r.Url.Host == "identity-api").ToList();
        Assert.HasCount(2, searches);
        Assert.IsTrue(searches.All(r => r.Url.Query.Contains("enabled=true") && r.Url.Query.Contains("excludeRole=Admin,Owner,Cashier")));
    }

    [TestMethod]
    public void An_exact_full_name_wins_and_otherwise_several_are_asked_about()
    {
        var hassan = new DirectoryUserView("1", null, null, "Ahmed", "Hassan", true, null, null, "+20100");
        var ali = new DirectoryUserView("2", null, null, "Ahmed", "Ali", true, null, null, "+20101");
        Assert.AreEqual("1", CustomerFinder.Pick([ali, hassan], ["ahmed hassan"], CustomerWhereabouts.None, "x").Match?.Id);
        var both = CustomerFinder.Pick([ali, hassan], ["ahmed"], CustomerWhereabouts.None, "Ahmed");
        Assert.IsTrue(both.Ambiguous);
        Assert.AreEqual("احمد", CustomerFinder.Normalize("أَحمد"));
    }

    [TestMethod]
    public void A_name_sounds_the_same_in_either_script()
    {
        Assert.AreEqual(CustomerFinder.Sound("Ahmed"), CustomerFinder.Sound("أحمد"));
        Assert.AreEqual(CustomerFinder.Sound("Mohammed"), CustomerFinder.Sound("محمد"));
        Assert.AreEqual(CustomerFinder.Sound("Mohamed"), CustomerFinder.Sound("محمد"));
        Assert.AreEqual(CustomerFinder.Sound("Sherif"), CustomerFinder.Sound("شريف"));
        Assert.AreEqual(CustomerFinder.Sound("Karim"), CustomerFinder.Sound("كريم"));
        Assert.AreEqual(CustomerFinder.Sound("Mona"), CustomerFinder.Sound("منى"));
        Assert.AreEqual(CustomerFinder.Sound("Abdallah"), CustomerFinder.Sound("عبدالله"));
        Assert.AreEqual(CustomerFinder.Sound("Fatma"), CustomerFinder.Sound("فاطمة"));
        Assert.AreEqual(CustomerFinder.Sound("Gamal"), CustomerFinder.Sound("جمال"));
        Assert.AreNotEqual(CustomerFinder.Sound("Karim"), CustomerFinder.Sound("Kamal"));
    }

    [TestMethod]
    public async Task A_name_said_in_Arabic_finds_the_account_saved_in_English()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "identity-api/api/identity/users", r =>
            HttpUtility.ParseQueryString(r.RequestUri!.Query)["search"] is null ? new[] { AhmedHassan, AhmedAli, Mona } : Array.Empty<object>());

        var found = await CustomerFinder.FindAsync(bench.Api, 1, "أحمد حسن", CustomerWhereabouts.None, default);
        Assert.AreEqual("u-hassan", found.Match?.Id, found.Why);

        var mona = await CustomerFinder.FindAsync(bench.Api, 1, "Mona", CustomerWhereabouts.None, default);
        Assert.AreEqual("u-mona", mona.Match?.Id, "and the other way: Mona finds منى");
    }

    // --- Ringing up ------------------------------------------------------------------

    [TestMethod]
    public async Task For_a_customer_with_an_open_bill_the_items_go_on_it_priced_by_the_menu()
    {
        var bench = Cafe();
        var tools = Tools(bench);

        var preview = Bench.JsonOf(await tools.RingUpOrder([new("latte", 2, ["oat milk"]), new("croissant")], customer: "Ahmed", requestId: "t1"));
        var text = preview.GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "on the bill Ahmed Hassan already has open at Room 2");
        StringAssert.Contains(text, "2 × Latte / لاتيه (Regular, Oat): EGP 120");
        StringAssert.Contains(text, "Total EGP 165");
        Assert.IsFalse(Ordered(bench), "the preview rings nothing up");

        var done = Bench.JsonOf(await tools.RingUpOrder([new("latte", 2, ["oat milk"]), new("croissant")], customer: "Ahmed", requestId: "t1", confirm: true, draft: preview.GetProperty("draft").GetString()));
        Assert.AreEqual(9001, done.GetProperty("orderId").GetInt32(), done.ToString());

        var sent = bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/orders/pos", StringComparison.Ordinal));
        Assert.AreEqual("1", sent.Branch);
        Assert.IsNotNull(sent.RequestId);
        var body = BodyOf(sent);
        Assert.AreEqual(501, body.GetProperty("ticketId").GetInt32());
        Assert.AreEqual("u-hassan", body.GetProperty("customerUserId").GetString());
        Assert.IsFalse(body.TryGetProperty("placeId", out _));
        var latte = body.GetProperty("items")[0];
        Assert.AreEqual(50m, latte.GetProperty("unitPrice").GetDecimal(), "the options' adjustments ride beside the item's price");
        Assert.AreEqual(2, latte.GetProperty("quantity").GetInt32());
        CollectionAssert.AreEqual(new[] { 31, 42 }, latte.GetProperty("selectedCustomizations").EnumerateArray().Select(c => c.GetProperty("optionId").GetInt32()).ToArray());
    }

    [TestMethod]
    public async Task A_new_bill_asked_for_is_a_new_counter_bill_and_a_free_table_gets_one()
    {
        var bench = Cafe();
        var tools = Tools(bench);

        var apart = Bench.JsonOf(await tools.RingUpOrder([new("croissant")], customer: "Ahmed", newBill: true, branch: "Nasr City"));
        StringAssert.Contains(apart.GetProperty("preview").GetString(), "on a new counter bill");

        var table = Bench.JsonOf(await tools.RingUpOrder([new("croissant")], where: "table 4", requestId: "t2"));
        StringAssert.Contains(table.GetProperty("preview").GetString(), "on a new bill for Table 4");
        await tools.RingUpOrder([new("croissant")], where: "table 4", requestId: "t2", confirm: true, draft: table.GetProperty("draft").GetString());
        var body = BodyOf(bench.Handler.Requests.Single(r => r.Url.AbsolutePath.EndsWith("/orders/pos", StringComparison.Ordinal)));
        Assert.AreEqual(4, body.GetProperty("placeId").GetInt32());
        Assert.IsFalse(body.TryGetProperty("ticketId", out _));
    }

    [TestMethod]
    public async Task An_open_bill_is_found_by_its_name_and_a_name_no_account_has_goes_on_bare()
    {
        var bench = Cafe();
        var json = Bench.JsonOf(await Tools(bench).RingUpOrder([new("croissant")], customer: "Karim"));
        StringAssert.Contains(json.GetProperty("preview").GetString(), "on the bill Karim already has open at counter bill \"Karim\"");
        StringAssert.Contains(json.GetProperty("customerNote").GetString(), "no points");

        var room = Bench.JsonOf(await Tools(bench).RingUpOrder([new("croissant")], bill: "room 2"));
        StringAssert.Contains(room.GetProperty("preview").GetString(), "on the open bill at Room 2");
    }

    [TestMethod]
    public async Task Two_Ahmeds_neither_here_are_asked_about_and_nothing_is_drafted()
    {
        var bench = Cafe(h => h.OnJson("GET", "sales-api/api/tickets/open", _ => Array.Empty<object>()).OnJson("GET", "spaces-api/api/stays/open", _ => Array.Empty<object>()));
        var json = Bench.JsonOf(await Tools(bench).RingUpOrder([new("croissant")], customer: "Ahmed"));
        Assert.IsTrue(json.GetProperty("needsChoice").GetBoolean());
        Assert.AreEqual(2, json.GetProperty("candidates").GetArrayLength());
        Assert.IsFalse(json.TryGetProperty("draft", out _));
    }

    [TestMethod]
    public void Options_are_found_loosely_a_must_pick_takes_its_default_and_two_sizes_are_refused()
    {
        var item = new CatalogItemDetail(11, new("Latte", "لاتيه"), null, 50, 4, null, true, false, null, null, null, null, false, null, null);
        List<CustomizationDto> groups =
        [
            new(21, new("Size", "الحجم"), true, false, 0, [new(31, new("Regular", "عادي"), 0, true, 0), new(32, new("Large", "كبير"), 15, false, 1)]),
            new(22, new("Milk", "اللبن"), false, false, 1, [new(41, new("Full cream", null), 0, true, 0), new(42, new("Oat", "شوفان"), 10, false, 1)]),
        ];

        var (chosen, error) = TillTools.ChooseOptions(item, groups, ["كبير", "oat milk"]);
        Assert.IsNull(error);
        CollectionAssert.AreEqual(new[] { 32, 42 }, chosen!.Select(c => c.Option.Id).ToArray());

        Assert.AreEqual(31, TillTools.ChooseOptions(item, groups, null).Chosen!.Single().Option.Id);
        StringAssert.Contains(TillTools.ChooseOptions(item, groups, ["regular", "large"]).Error, "takes one Size");
        StringAssert.Contains(TillTools.ChooseOptions(item, groups, ["caramel"]).Error, "has no option");
    }

    // --- A customer on a room ----------------------------------------------------------

    [TestMethod]
    public async Task A_walk_in_room_gets_its_owner_and_a_claimed_one_a_member()
    {
        var bench = Cafe(h => h.On("POST", "spaces-api/api/stays", _ => FakeHandler.Json(new { })));
        var tools = Tools(bench);

        StringAssert.Contains(Bench.JsonOf(await tools.AssignRoomCustomer("room 3", "منى")).GetProperty("preview").GetString(), "the customer of Room 3");
        await tools.AssignRoomCustomer("room 3", "منى", requestId: "r1", confirm: true);
        var assign = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("/api/stays/78/assign-customer", assign.Url.AbsolutePath);
        Assert.AreEqual("u-mona", BodyOf(assign).GetProperty("customerId").GetString());

        StringAssert.Contains(Bench.JsonOf(await tools.AssignRoomCustomer("room 2", "منى")).GetProperty("preview").GetString(), "to the party in Room 2");
        Assert.IsTrue((await tools.AssignRoomCustomer("room 2", "Ahmed Hassan", confirm: true)).IsError, "he is already in it");
    }
}
