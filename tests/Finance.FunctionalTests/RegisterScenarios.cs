using System.Net;
using System.Net.Http.Headers;
using Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;
using Ninja.Testing;

namespace Ninja.Finance.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public const string Version = "api-version=1.0";

    public static ServiceUnderTest<Program> Finance { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Finance = new ServiceUnderTest<Program>("financedb");
        _ = Finance.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Finance.DisposeAsync();
        await SharedServices.StopAsync();
    }

    // A branch keeps its own books, so each scenario that adds money up gets its own
    private static int _nextBranch = 100;

    public static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    public static Caller BackOfficeAt(int branch) => Finance.As(Persona.Admin(branch), branch);

    public static Caller OwnerAt(int branch) => Finance.As(Persona.Owner(branch), branch);

    public static Caller TillAt(int branch) => Finance.As(Persona.Cashier(branch), branch);

    public static string Url(string tail) => $"/api/finance{tail}?{Version}";
}

/// <summary>
/// What the apps read off the wire; named here so a change in the API's
/// shape fails a test. Finance has no string-enum converter, so where the
/// money came from and what wrote the line travel as their numbers — which
/// is the contract the admin app is written against.
/// </summary>
public record CreatedView(int Id);
public record LocalizedView(string En, string? Ar);
public record CategoryView(int Id, LocalizedView Name, int DisplayOrder, bool IsActive);
public record CategoryTotalView(int CategoryId, LocalizedView CategoryName, decimal Total);
public record ExpensesView(decimal Total, List<CategoryTotalView> ByCategory, List<ExpenseView> Expenses);

public record ExpenseView(
    int Id,
    int BranchId,
    DateOnly Date,
    int CategoryId,
    LocalizedView CategoryName,
    decimal Amount,
    PaidFrom PaidFrom,
    int? PartnerId,
    string? PartnerName,
    string? Vendor,
    string? Note,
    string? Reference,
    FinanceSource Source,
    string RecordedBy,
    DateTime? VoidedAt,
    string? VoidedBy,
    string? VoidReason,
    bool HasReceipt);

public record RecurringView(int Id, int BranchId, int CategoryId, decimal Amount, int DayOfMonth, PaidFrom PaidFrom, string? Vendor, bool IsActive);

/// <summary>
/// The month's register: the categories a café starts with, a bill keyed
/// in, the photo of it, one voided with a reason, and the monthly bills
/// that post themselves.
/// </summary>
[TestClass]
public sealed class RegisterScenarios
{
    /// <summary>A month in the past, so the hourly job that posts this month's bills is never in the way.</summary>
    private const string March = "2026-03";

    private static Caller BackOffice => Suite.BackOfficeAt(Suite.Branch);

    private static string Month => Suite.Url("/expenses") + $"&from={March}-01&to={March}-31";

    private static async Task<int> CategoryAsync(string named)
    {
        var categories = await BackOffice.GetAsync<List<CategoryView>>(Suite.Url("/categories"));
        return categories.First(c => c.Name.En == named).Id;
    }

    private static async Task<int> AnExpenseAsync(Caller books, int categoryId, decimal amount, string day = "10", string? vendor = null)
    {
        var created = await books.PostAsync<CreatedView>(Suite.Url("/expenses"), new
        {
            date = $"{March}-{day}",
            categoryId,
            amount,
            paidFrom = (int)PaidFrom.Drawer,
            vendor,
            note = (string?)null,
        });
        return created.Id;
    }

    [TestMethod]
    public async Task A_cafe_starts_with_the_bills_every_cafe_has()
    {
        var categories = await BackOffice.GetAsync<List<CategoryView>>(Suite.Url("/categories"));

        Assert.IsTrue(categories.Any(c => c.Name.En == "Rent"), "rent, electricity and the rest are there from the first day");
        Assert.IsTrue(categories.Any(c => c.Name.En == "Electricity"));
        Assert.AreEqual("إيجار", categories.First(c => c.Name.En == "Rent").Name.Ar, "in both the languages the café reads");

        var mine = await BackOffice.PostAsync<CreatedView>(Suite.Url("/categories"), new
        {
            name = new { en = "Music licence", ar = "رخصة موسيقى" },
            displayOrder = 50,
        });

        var renamed = await BackOffice.PostAsync<CreatedView>(Suite.Url("/categories"), new
        {
            id = mine.Id,
            name = new { en = "Music", ar = "موسيقى" },
            displayOrder = 50,
            isActive = false,
        });
        Assert.AreEqual(mine.Id, renamed.Id, "the same category, edited, not a second one");

        var listed = await BackOffice.GetAsync<List<CategoryView>>(Suite.Url("/categories"));
        Assert.IsFalse(listed.Any(c => c.Id == mine.Id), "one switched off is off the form");

        var all = await BackOffice.GetAsync<List<CategoryView>>(Suite.Url("/categories") + "&includeInactive=true");
        var off = all.Single(c => c.Id == mine.Id);
        Assert.AreEqual("Music", off.Name.En);
        Assert.IsFalse(off.IsActive, "but the months already under it keep their name");
    }

    [TestMethod]
    public async Task A_bill_keyed_in_lands_in_the_months_register_under_its_category()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var rent = await CategoryAsync("Rent");
        var power = await CategoryAsync("Electricity");

        await AnExpenseAsync(books, rent, 5000m, "05", "The landlord");
        await AnExpenseAsync(books, power, 700m, "12");
        await AnExpenseAsync(books, power, 300m, "20");

        var month = await books.GetAsync<ExpensesView>(Month);
        Assert.AreEqual(6000m, month.Total, "the month is what was spent in it");
        Assert.AreEqual(5000m, month.ByCategory.Single(c => c.CategoryId == rent).Total);
        Assert.AreEqual(1000m, month.ByCategory.Single(c => c.CategoryId == power).Total, "two electricity bills are one line on the summary");

        var line = month.Expenses.Single(e => e.Amount == 5000m);
        Assert.AreEqual(branch, line.BranchId);
        Assert.AreEqual("The landlord", line.Vendor);
        Assert.AreEqual("Rent", line.CategoryName.En);
        Assert.AreEqual(PaidFrom.Drawer, line.PaidFrom);
        Assert.AreEqual(FinanceSource.Manual, line.Source, "keyed in by hand, not by the till");
        Assert.IsFalse(line.HasReceipt);
        Assert.IsNull(line.VoidedAt);

        // The register belongs to the branch that spent it
        var elsewhere = await Suite.BackOfficeAt(Suite.NewBranch()).GetAsync<ExpensesView>(Month);
        Assert.AreEqual(0m, elsewhere.Total, "another branch's rent is not this branch's");

        var april = await books.GetAsync<ExpensesView>(Suite.Url("/expenses") + "&from=2026-04-01&to=2026-04-30");
        Assert.AreEqual(0m, april.Total, "and March's rent is not April's");
    }

    [TestMethod]
    public async Task A_bill_keyed_in_wrong_is_voided_with_a_reason_and_stays_on_the_page()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await AnExpenseAsync(books, await CategoryAsync("Maintenance"), 450m, "08", "The plumber");

        var (voided, detail) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/expenses/{id}/void"), new { reason = "Keyed twice" });
        Assert.AreEqual(HttpStatusCode.OK, voided, detail);

        var month = await books.GetAsync<ExpensesView>(Month);
        Assert.AreEqual(0m, month.Total, "a voided bill is not spending");
        Assert.IsEmpty(month.ByCategory, "and it is off the summary");

        var line = month.Expenses.Single(e => e.Id == id);
        Assert.IsNotNull(line.VoidedAt, "but it is still on the page, struck through");
        Assert.AreEqual("Keyed twice", line.VoidReason);
        Assert.AreEqual("Admin", line.VoidedBy);

        var (twice, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/expenses/{id}/void"), new { reason = "Again" });
        Assert.AreEqual(HttpStatusCode.BadRequest, twice, "voiding what is already void is nothing");
        Assert.Contains("already", why);

        var second = await AnExpenseAsync(books, await CategoryAsync("Maintenance"), 60m, "09");
        var (noReason, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/expenses/{second}/void"), new { reason = "  " });
        Assert.AreEqual(HttpStatusCode.BadRequest, noReason, "money is not struck off without a word why");
    }

    [TestMethod]
    public async Task The_photo_of_the_bill_is_kept_with_the_expense()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await AnExpenseAsync(books, await CategoryAsync("Gas"), 220m, "11");

        var photo = new byte[] { 0x89, (byte)'P', (byte)'N', (byte)'G', 1, 2, 3, 4 };
        Assert.AreEqual(HttpStatusCode.OK, await UploadAsync(books, id, photo, "image/png", "bill.png"));

        var line = (await books.GetAsync<ExpensesView>(Month)).Expenses.Single(e => e.Id == id);
        Assert.IsTrue(line.HasReceipt, "the page says there is a bill behind it");

        using var kept = await books.RawAsync(HttpMethod.Get, Suite.Url($"/expenses/{id}/receipt"));
        Assert.AreEqual(HttpStatusCode.OK, kept.StatusCode);
        Assert.AreEqual("image/png", kept.Content.Headers.ContentType?.MediaType);
        CollectionAssert.AreEqual(photo, await kept.Content.ReadAsByteArrayAsync(), "the file comes back as it went up");

        var scan = new byte[] { (byte)'%', (byte)'P', (byte)'D', (byte)'F', 9 };
        Assert.AreEqual(HttpStatusCode.OK, await UploadAsync(books, id, scan, "application/pdf", "bill.pdf"));
        using var replaced = await books.RawAsync(HttpMethod.Get, Suite.Url($"/expenses/{id}/receipt"));
        Assert.AreEqual("application/pdf", replaced.Content.Headers.ContentType?.MediaType, "one bill, one photo: uploading again replaces it");

        Assert.AreEqual(HttpStatusCode.BadRequest, await UploadAsync(books, id, "not a bill"u8.ToArray(), "text/plain", "note.txt"),
            "a receipt is a photo or a PDF");

        var (removed, _) = await books.RefusedAsync(HttpMethod.Delete, Suite.Url($"/expenses/{id}/receipt"));
        Assert.AreEqual(HttpStatusCode.OK, removed);
        using var gone = await books.RawAsync(HttpMethod.Get, Suite.Url($"/expenses/{id}/receipt"));
        Assert.AreEqual(HttpStatusCode.NotFound, gone.StatusCode);
        Assert.IsFalse((await books.GetAsync<ExpensesView>(Month)).Expenses.Single(e => e.Id == id).HasReceipt);
    }

    [TestMethod]
    public async Task A_monthly_bill_is_written_down_once_and_can_be_switched_off()
    {
        // Its own branch: the hourly job posts a bill that has come due, and that is its business, not this scenario's
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var internet = await CategoryAsync("Internet");

        var bill = await books.PostAsync<CreatedView>(Suite.Url("/recurring"), new
        {
            categoryId = internet,
            amount = 900m,
            dayOfMonth = 5,
            paidFrom = (int)PaidFrom.Bank,
            vendor = "The exchange",
        });

        var listed = (await books.GetAsync<List<RecurringView>>(Suite.Url("/recurring"))).Single(r => r.Id == bill.Id);
        Assert.AreEqual(900m, listed.Amount);
        Assert.AreEqual(5, listed.DayOfMonth);
        Assert.AreEqual(PaidFrom.Bank, listed.PaidFrom);
        Assert.AreEqual(branch, listed.BranchId);
        Assert.IsTrue(listed.IsActive);

        var raised = await books.PostAsync<CreatedView>(Suite.Url("/recurring"), new
        {
            id = bill.Id,
            categoryId = internet,
            amount = 1100m,
            dayOfMonth = 5,
            paidFrom = (int)PaidFrom.Bank,
            vendor = "The exchange",
            isActive = false,
        });
        Assert.AreEqual(bill.Id, raised.Id, "the same bill, edited");

        var after = (await books.GetAsync<List<RecurringView>>(Suite.Url("/recurring"))).Single(r => r.Id == bill.Id);
        Assert.AreEqual(1100m, after.Amount, "the new price stands");
        Assert.IsFalse(after.IsActive, "and a bill switched off posts nothing");

        var (badDay, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/recurring"), new
        {
            categoryId = internet,
            amount = 100m,
            dayOfMonth = 31,
            paidFrom = (int)PaidFrom.Bank,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, badDay, why);
        Assert.Contains("28", why, "every month has a 28th; not every month has a 31st");
    }

    [TestMethod]
    public async Task What_the_register_will_not_write_down()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var rent = await CategoryAsync("Rent");

        var (nothing, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/expenses"), new
        {
            date = $"{March}-10", categoryId = rent, amount = 0m, paidFrom = (int)PaidFrom.Drawer,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, why);

        var (backwards, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/expenses"), new
        {
            date = $"{March}-10", categoryId = rent, amount = -100m, paidFrom = (int)PaidFrom.Drawer,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, backwards, "an expense is money out, not money in");

        var (noCategory, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/expenses"), new
        {
            date = $"{March}-10", categoryId = 999999, amount = 100m, paidFrom = (int)PaidFrom.Drawer,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, noCategory, "a bill belongs under something");

        var (noPartner, told) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/expenses"), new
        {
            date = $"{March}-10", categoryId = rent, amount = 100m, paidFrom = (int)PaidFrom.Partner,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, noPartner);
        Assert.Contains("partner", told.ToLowerInvariant(), "money from a pocket needs whose pocket");

        var (noName, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/categories"), new
        {
            name = new { en = "  " }, displayOrder = 1,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, noName);
    }

    [TestMethod]
    public async Task The_register_is_the_back_offices_and_the_till_only_picks_from_it()
    {
        var branch = Suite.NewBranch();

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Month, null),
            (HttpMethod.Post, Suite.Url("/expenses"), new { date = $"{March}-10", categoryId = 1, amount = 10m, paidFrom = 0 }),
            (HttpMethod.Get, Suite.Url("/recurring"), null),
            (HttpMethod.Post, Suite.Url("/categories"), new { name = new { en = "Mine" }, displayOrder = 1 }),
        })
        {
            var (byTill, _) = await Suite.TillAt(branch).RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byTill, $"{method} {path} is not the till's");

            var (byGuest, _) = await Suite.Finance.As(Persona.Customer(), branch).RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byGuest, $"{method} {path} is nobody else's either");
        }

        using var nobody = Suite.Finance.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Month)).StatusCode);

        // What the till does need: what a pay-out from the drawer can be for
        var categories = await Suite.TillAt(branch).GetAsync<List<CategoryView>>($"/api/finance/till/categories?{Suite.Version}");
        Assert.IsTrue(categories.Any(c => c.Name.En == "Maintenance"), "a pay-out at the till says what it was for");

        // A manager reads the branch they are assigned to, and no other
        var visiting = Suite.Finance.As(Persona.Admin(branch), branch + 1);
        var (foreignBranch, _) = await visiting.RefusedAsync(HttpMethod.Get, Month);
        Assert.AreEqual(HttpStatusCode.Forbidden, foreignBranch, "another branch's books are not theirs to read");
    }

    private static async Task<HttpStatusCode> UploadAsync(Caller books, int expenseId, byte[] bytes, string contentType, string fileName)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);

        using var response = await books.Http.PostAsync(Suite.Url($"/expenses/{expenseId}/receipt"), form);
        return response.StatusCode;
    }
}
