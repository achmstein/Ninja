using System.Net;
using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class WriteToolsTests
{
    private static Bench WithFinance(Bench bench)
    {
        bench.Handler.OnJson("GET", "finance-api/api/finance/categories", _ => new object[]
        {
            new { id = 1, name = new { en = "Rent", ar = "إيجار" }, displayOrder = 1, isActive = true },
            new { id = 2, name = new { en = "Electricity", ar = "كهرباء" }, displayOrder = 2, isActive = true },
            new { id = 3, name = new { en = "Old Electricity", ar = "كهرباء قديمة" }, displayOrder = 3, isActive = false },
        });
        return bench;
    }

    private static WriteTools Tools(Bench bench) => new(bench.Tenant, bench.Api, bench.Audit, bench.Accessor, bench.Clock);

    [TestMethod]
    public async Task A_preview_writes_nothing_and_says_what_would_happen()
    {
        var bench = WithFinance(new Bench().WithTenant());
        var result = await Tools(bench).RecordExpense(350, "electricity", null, "Nasr City", "drawer", "E-Co", "meter 12345", "req-1", confirm: false, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        var preview = json.GetProperty("preview").GetString()!;
        StringAssert.Contains(preview, "EGP 350");
        StringAssert.Contains(preview, "Electricity");
        StringAssert.Contains(preview, "Nasr City");
        StringAssert.Contains(preview, "2026-09-21", "15:00 Cairo with a 17:00 day start is still the 21st");
        StringAssert.Contains(preview, "E-Co");
        Assert.AreEqual("req-1", json.GetProperty("requestId").GetString());
        StringAssert.Contains(json.GetProperty("nextStep").GetString(), "confirm=true");
        Assert.IsFalse(bench.Handler.Requests.Any(r => r.Method == HttpMethod.Post));
    }

    [TestMethod]
    public async Task Confirming_posts_once_with_a_stable_idempotency_key_and_the_branch()
    {
        var bench = WithFinance(new Bench().WithTenant());
        bench.Handler.OnJson("POST", "finance-api/api/finance/expenses", _ => new { id = 77 });
        var tools = Tools(bench);

        var result = await tools.RecordExpense(350, "Electricity", "2026-09-20", "1", "bank", null, null, "req-1", confirm: true, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        Assert.AreEqual(77, json.GetProperty("expenseId").GetInt32());
        var post = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.AreEqual("1", post.Branch);
        Assert.AreEqual(WriteTools.IdempotencyKey("owner-1", "record_expense", "req-1").ToString(), post.RequestId);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual("2026-09-20", body.RootElement.GetProperty("date").GetString());
        Assert.AreEqual(2, body.RootElement.GetProperty("categoryId").GetInt32());
        Assert.AreEqual(350m, body.RootElement.GetProperty("amount").GetDecimal());
        Assert.AreEqual(1, body.RootElement.GetProperty("paidFrom").GetInt32(), "bank");
        Assert.AreEqual(JsonValueKind.Null, body.RootElement.GetProperty("partnerId").ValueKind);

        // the same request id from the same person is the same key: a retried confirm cannot record twice
        Assert.AreEqual(WriteTools.IdempotencyKey("owner-1", "record_expense", "req-1"), WriteTools.IdempotencyKey("owner-1", "record_expense", "req-1"));
        Assert.AreNotEqual(WriteTools.IdempotencyKey("owner-1", "record_expense", "req-1"), WriteTools.IdempotencyKey("owner-2", "record_expense", "req-1"));
    }

    [TestMethod]
    public async Task A_replayed_confirm_reports_already_recorded()
    {
        var bench = WithFinance(new Bench().WithTenant());
        bench.Handler.OnJson("POST", "finance-api/api/finance/expenses", _ => new { id = 0 });

        var json = Bench.JsonOf(await Tools(bench).RecordExpense(10, "Rent", null, "Maadi", "drawer", null, null, "req-9", confirm: true, CancellationToken.None));

        Assert.IsTrue(json.GetProperty("recorded").GetBoolean());
        StringAssert.Contains(json.GetProperty("note").GetString(), "already been recorded");
    }

    [TestMethod]
    public async Task Bad_input_is_refused_before_anything_is_looked_up()
    {
        var bench = WithFinance(new Bench().WithTenant());
        var tools = Tools(bench);

        Assert.IsTrue((await tools.RecordExpense(0, "Rent", null, null, "drawer", null, null, null, false, CancellationToken.None)).IsError);
        Assert.IsTrue((await tools.RecordExpense(10, "Rent", null, null, "crypto", null, null, null, false, CancellationToken.None)).IsError);

        var noBranch = await tools.RecordExpense(10, "Rent", null, null, "drawer", null, null, null, false, CancellationToken.None);
        StringAssert.Contains(Bench.TextOf(noBranch), "Say which branch");

        var noCategory = await tools.RecordExpense(10, "Marketing", null, "1", "drawer", null, null, null, false, CancellationToken.None);
        StringAssert.Contains(Bench.TextOf(noCategory), "Rent, Electricity");
        Assert.IsFalse(Bench.TextOf(noCategory).Contains("Old Electricity", StringComparison.Ordinal), "inactive categories are not offered");

        var badDate = await tools.RecordExpense(10, "Rent", "20/09/2026", "1", "drawer", null, null, null, false, CancellationToken.None);
        Assert.IsTrue(badDate.IsError);
    }

    [TestMethod]
    public async Task A_service_refusal_comes_back_as_its_own_words()
    {
        var bench = WithFinance(new Bench().WithTenant());
        bench.Handler.On("POST", "finance-api/api/finance/expenses", _ => FakeHandler.Text("\"Money from a partner's pocket needs the partner.\"", HttpStatusCode.BadRequest));

        var result = await Tools(bench).RecordExpense(10, "Rent", null, "1", "drawer", null, null, "r", confirm: true, CancellationToken.None);

        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "needs the partner");
    }

    [TestMethod]
    public async Task Sold_out_is_a_branch_patch_after_a_preview()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "catalog-api/api/catalog/items", _ => new object[]
        {
            new { id = 11, name = new { en = "Turkish Coffee", ar = "قهوة تركي" }, price = 30, catalogTypeId = 1, isAvailable = true, isOutOfStock = false },
            new { id = 12, name = new { en = "Iced Coffee", ar = "قهوة مثلجة" }, price = 45, catalogTypeId = 1, isAvailable = true, isOutOfStock = false },
        });
        bench.Handler.OnJson("PATCH", "catalog-api/api/catalog/items/11/availability", _ => new { id = 11, name = new { en = "Turkish Coffee" }, price = 30, catalogTypeId = 1, isAvailable = false, isOutOfStock = false });
        var tools = Tools(bench);

        var ambiguous = await tools.SetItemAvailability("coffee", false, "Maadi", null, false, CancellationToken.None);
        Assert.IsTrue(ambiguous.IsError);
        StringAssert.Contains(Bench.TextOf(ambiguous), "Several menu items match");

        var preview = Bench.JsonOf(await tools.SetItemAvailability("turkish coffee", false, "Maadi", "r1", false, CancellationToken.None));
        StringAssert.Contains(preview.GetProperty("preview").GetString(), "sold out at Maadi");
        Assert.IsFalse(bench.Handler.Requests.Any(r => r.Method == HttpMethod.Patch));

        var done = Bench.JsonOf(await tools.SetItemAvailability("11", false, "Maadi", "r1", true, CancellationToken.None));
        Assert.IsFalse(done.GetProperty("isAvailable").GetBoolean());
        var patch = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.AreEqual("2", patch.Branch);
        StringAssert.Contains(patch.Body, "\"isAvailable\":false");
    }

    [TestMethod]
    public async Task Pausing_ordering_patches_the_branch_settings()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("PATCH", "tenant-api/api/branches/1/settings", _ => new { id = 1, name = new { en = "Nasr City" }, isActive = true, isOrderingEnabled = false, isReservationsEnabled = true });
        var tools = Tools(bench);

        var preview = Bench.JsonOf(await tools.PauseOnlineOrdering(true, "Nasr", "r2", false, CancellationToken.None));
        StringAssert.Contains(preview.GetProperty("preview").GetString(), "Pause online ordering at Nasr City");

        var done = Bench.JsonOf(await tools.PauseOnlineOrdering(true, "Nasr", "r2", true, CancellationToken.None));
        Assert.AreEqual("paused", done.GetProperty("onlineOrdering").GetString());
        var patch = bench.Handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.AreEqual("http://tenant-api/api/branches/1/settings", patch.Url.ToString());
        StringAssert.Contains(patch.Body, "\"isOrderingEnabled\":false");
    }
}
