using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class FinanceWriteToolsTests
{
    internal static WriteFlow Flow(Bench bench)
    {
        var signer = new DraftSigner(Microsoft.Extensions.Options.Options.Create(new AssistantOptions { DraftKey = "k" }), bench.Clock, NullLogger<DraftSigner>.Instance);
        return new WriteFlow(bench.Audit, bench.Accessor, signer, new WriteLimiter(bench.Clock));
    }

    internal static IEnumerable<SeenRequest> Writes(Bench bench) => bench.Handler.Requests.Where(r => r.Method != HttpMethod.Get);

    private static FinanceWriteTools Tools(Bench bench) => new(bench.Tenant, bench.Api, Flow(bench), bench.Clock);

    private static Bench Books()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "finance-api/api/finance/categories", _ => new object[]
        {
            new { id = 1, name = new { en = "Rent", ar = "إيجار" }, displayOrder = 1, isActive = true },
            new { id = 2, name = new { en = "Internet", ar = "إنترنت" }, displayOrder = 2, isActive = true },
        });
        bench.Handler.OnJson("GET", "finance-api/api/finance/suppliers", _ => new object[]
        {
            new { id = 5, name = "Nile Dairy", phone = "+201001234567", notes = "Milk, Sundays", isActive = true, balance = 8000 },
            new { id = 6, name = "Al Ahram Bakery", phone = (string?)null, notes = (string?)null, isActive = true, balance = 0 },
        });
        bench.Handler.OnJson("GET", "finance-api/api/finance/recurring", _ => new object[]
        {
            new { id = 9, branchId = 2, categoryId = 2, categoryName = new { en = "Internet", ar = "إنترنت" }, amount = 600, dayOfMonth = 5, paidFrom = 1, partnerId = (int?)null, partnerName = (string?)null, vendor = "WE", note = (string?)null, isActive = true },
        });
        return bench;
    }

    [TestMethod]
    public async Task A_category_previews_in_both_languages_then_posts()
    {
        var bench = Books();
        bench.Handler.OnJson("POST", "finance-api/api/finance/categories", _ => new { id = 31 });
        var tools = Tools(bench);

        var preview = await tools.CreateExpenseCategory("Packaging", "تغليف", "r1");
        Assert.AreNotEqual(true, preview.IsError, Bench.TextOf(preview));
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "\"Packaging / تغليف\"");
        Assert.IsFalse(Writes(bench).Any(), "a preview writes nothing");

        var done = await tools.CreateExpenseCategory("Packaging", "تغليف", "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        Assert.AreEqual(31, Bench.JsonOf(done).GetProperty("categoryId").GetInt32());
        var post = Writes(bench).Single();
        Assert.AreEqual("/api/finance/categories", post.Url.AbsolutePath);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual("Packaging", body.RootElement.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual("تغليف", body.RootElement.GetProperty("name").GetProperty("ar").GetString());
        Assert.AreEqual(JsonValueKind.Null, body.RootElement.GetProperty("id").ValueKind);
    }

    [TestMethod]
    public async Task A_category_that_exists_is_not_added_twice()
    {
        var bench = Books();
        var preview = await Tools(bench).CreateExpenseCategory("إيجار", requestId: "r1");
        Assert.IsTrue(preview.IsError);
        StringAssert.Contains(Bench.TextOf(preview), "already a category");

        var retried = await Tools(bench).CreateExpenseCategory("rent", requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, retried.IsError);
        Assert.IsFalse(Writes(bench).Any(), "a retried confirm writes nothing");
    }

    [TestMethod]
    public async Task A_new_supplier_is_added_and_an_existing_one_keeps_what_was_not_named()
    {
        var bench = Books();
        bench.Handler.OnJson("POST", "finance-api/api/finance/suppliers", r => new { id = 40 });
        var tools = Tools(bench);

        var add = await tools.SaveSupplier("Cairo Cups", phone: "01112223334", requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(add).GetProperty("preview").GetString(), "Add the supplier \"Cairo Cups\", phone 01112223334");
        Assert.IsFalse(Writes(bench).Any());

        var edit = await tools.SaveSupplier("nile dairy", phone: "0222222222", requestId: "r2", confirm: true);
        Assert.AreNotEqual(true, edit.IsError, Bench.TextOf(edit));
        using var body = JsonDocument.Parse(Writes(bench).Single().Body!);
        Assert.AreEqual(5, body.RootElement.GetProperty("id").GetInt32());
        Assert.AreEqual("Nile Dairy", body.RootElement.GetProperty("name").GetString());
        Assert.AreEqual("0222222222", body.RootElement.GetProperty("phone").GetString());
        Assert.AreEqual("Milk, Sundays", body.RootElement.GetProperty("notes").GetString(), "the notes stay");
    }

    [TestMethod]
    public async Task A_near_supplier_name_is_asked_about_not_guessed()
    {
        var bench = Books();
        var result = await Tools(bench).SaveSupplier("Nile", phone: "0100", requestId: "r1");
        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "close to the supplier \"Nile Dairy\"");

        var anyway = await Tools(bench).SaveSupplier("Nile", phone: "0100", addNew: true, requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(anyway).GetProperty("preview").GetString(), "Add the supplier \"Nile\"");
    }

    [TestMethod]
    public async Task A_supplier_payment_is_previewed_with_the_balance_then_posted_with_its_key()
    {
        var bench = Books();
        bench.Handler.OnJson("POST", "finance-api/api/finance/suppliers/5/ledger", _ => new { id = 300 });
        var tools = Tools(bench);

        var preview = await tools.RecordSupplierPayment("Nile Dairy", 5000, branch: "Maadi", note: "transfer 778", requestId: "r1");
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "EGP 5000 to \"Nile Dairy\" on 2026-09-22 at Maadi");
        StringAssert.Contains(text, "EGP 8000 now, EGP 3000 after");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.RecordSupplierPayment("5", 5000, branch: "Maadi", note: "transfer 778", requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        var post = Writes(bench).Single();
        Assert.AreEqual("2", post.Branch);
        Assert.AreEqual(WriteTools.IdempotencyKey("owner-1", "record_supplier_payment", "r1|payment").ToString(), post.RequestId);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual(1, body.RootElement.GetProperty("type").GetInt32(), "a payment");
        Assert.AreEqual(5000m, body.RootElement.GetProperty("amount").GetDecimal());
        Assert.AreEqual("2026-09-22", body.RootElement.GetProperty("date").GetString());
    }

    [TestMethod]
    public async Task A_monthly_bill_is_added_or_edited_keeping_what_was_not_named()
    {
        var bench = Books();
        bench.Handler.OnJson("POST", "finance-api/api/finance/recurring", _ => new { id = 12 });
        var tools = Tools(bench);

        var add = await tools.SetRecurringExpense("rent", 20000, 1, "Maadi", requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(add).GetProperty("preview").GetString(), "EGP 20000 under Rent / إيجار at Maadi / المعادي on day 1 of every month, paid from the bank");
        Assert.IsFalse(Writes(bench).Any());

        var edit = await tools.SetRecurringExpense("Internet", 650, branch: "Maadi", requestId: "r2", confirm: true);
        Assert.AreNotEqual(true, edit.IsError, Bench.TextOf(edit));
        var post = Writes(bench).Single();
        Assert.AreEqual("2", post.Branch);
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual(9, body.RootElement.GetProperty("id").GetInt32());
        Assert.AreEqual(650m, body.RootElement.GetProperty("amount").GetDecimal());
        Assert.AreEqual(5, body.RootElement.GetProperty("dayOfMonth").GetInt32(), "the day stays");
        Assert.AreEqual("WE", body.RootElement.GetProperty("vendor").GetString());
        Assert.AreEqual(1, body.RootElement.GetProperty("paidFrom").GetInt32());
    }

    [TestMethod]
    public async Task A_day_past_the_28th_is_refused()
    {
        var result = await Tools(Books()).SetRecurringExpense("rent", 20000, 31, "Maadi");
        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "1 to 28");
    }
}
