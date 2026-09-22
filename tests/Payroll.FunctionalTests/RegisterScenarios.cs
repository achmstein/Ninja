using System.Net;
using Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;
using Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Ninja.Payroll.Domain.AggregatesModel.LedgerAggregate;
using Ninja.Payroll.Domain.AggregatesModel.PayslipAggregate;
using Ninja.Testing;

namespace Ninja.Payroll.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const string Version = "api-version=1.0";

    public static ServiceUnderTest<Program> Payroll { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Payroll = new ServiceUnderTest<Program>("payrolldb");
        _ = Payroll.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Payroll.DisposeAsync();
        await SharedServices.StopAsync();
    }

    // A branch keeps its own register, so each scenario hires its own people
    private static int _nextBranch = 100;

    public static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    public static Caller BackOfficeAt(int branch) => Payroll.As(Persona.Admin(branch), branch);

    public static Caller OwnerAt(int branch) => Payroll.As(Persona.Owner(branch), branch);

    public static Caller TillAt(int branch) => Payroll.As(Persona.Cashier(branch), branch);

    public static string Url(string tail) => $"/api/payroll{tail}?{Version}";

    /// <summary>Someone on the register, on the pay they start on.</summary>
    public static async Task<int> HireAsync(
        Caller books,
        int branch,
        string name,
        PayScheme scheme = PayScheme.Daily,
        decimal rate = 200m,
        string startedOn = "2026-03-01",
        string? userId = null,
        string? jobTitle = "Barista")
    {
        var hired = await books.PostAsync<CreatedView>(Url("/employees"), new
        {
            name,
            jobTitle,
            phone = (string?)null,
            branchId = branch,
            userId,
            startedOn,
            scheme = (int)scheme,
            rate,
        });
        return hired.Id;
    }
}

/// <summary>
/// What the apps read off the wire; named here so a change in the API's
/// shape fails a test. Payroll has no string-enum converter, so a pay
/// scheme, a day's status and a ledger line's type travel as their numbers
/// — which is the contract the admin app is written against.
/// </summary>
public record CreatedView(int Id);
public record GeneratedView(List<int> Ids);
public record PayTermsView(DateOnly EffectiveFrom, PayScheme Scheme, decimal Rate);

public record EmployeeView(
    int Id,
    string Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    DateOnly StartedOn,
    DateOnly? EndedOn,
    bool IsActive,
    int PaidDaysOff,
    PayTermsView? CurrentTerms,
    decimal Balance,
    List<PayTermsView> Terms);

public record TillEmployeeView(int Id, string Name, string? JobTitle, PayScheme Scheme, decimal? Balance);
public record AttendanceView(int EmployeeId, DateOnly Date, int BranchId, AttendanceStatus Status, decimal OvertimeHours, string? Note, string MarkedBy);
public record LedgerEntryView(int Id, int EmployeeId, LedgerEntryType Type, decimal Amount, decimal Signed, DateOnly Date, string? Note, string? Reference, LedgerSource Source, string RecordedBy);
public record LedgerView(int EmployeeId, decimal Balance, List<LedgerEntryView> Entries);

public record PayslipView(
    int Id,
    int EmployeeId,
    string EmployeeName,
    int BranchId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    PayScheme Scheme,
    decimal Rate,
    decimal DaysWorked,
    decimal PaidOffDays,
    decimal Earned,
    decimal OvertimeHours,
    decimal OvertimePay,
    decimal AbsentDays,
    decimal AbsenceDeduction,
    decimal Bonuses,
    decimal Deductions,
    decimal Advances,
    decimal Payments,
    decimal CarriedOver,
    decimal AmountDue,
    decimal Remaining,
    PayslipStatus Status,
    decimal? PaidAmount,
    string? PaidBy,
    string? Note);

/// <summary>
/// The register: who works at the café, on what pay, who set it, and who
/// left. What someone is paid is the owner's call; everything else is the
/// branch manager's.
/// </summary>
[TestClass]
public sealed class RegisterScenarios
{
    [TestMethod]
    public async Task Someone_hired_is_on_the_register_with_the_pay_they_start_on()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Mahmoud", PayScheme.Daily, 200m);

        var listed = (await books.GetAsync<List<EmployeeView>>(Suite.Url("/employees"))).Single();
        Assert.AreEqual(id, listed.Id);
        Assert.AreEqual("Mahmoud", listed.Name);
        Assert.AreEqual("Barista", listed.JobTitle);
        Assert.AreEqual(branch, listed.BranchId);
        Assert.IsTrue(listed.IsActive);
        Assert.AreEqual(0m, listed.Balance, "nobody is owed anything on the first day");
        Assert.AreEqual(4, listed.PaidDaysOff, "four paid days off a month unless the café says otherwise");
        Assert.AreEqual(PayScheme.Daily, listed.CurrentTerms!.Scheme);
        Assert.AreEqual(200m, listed.CurrentTerms.Rate);
        Assert.AreEqual(new DateOnly(2026, 3, 1), listed.CurrentTerms.EffectiveFrom, "the pay runs from the day they started");

        var one = await books.GetAsync<EmployeeView>(Suite.Url($"/employees/{id}"));
        Assert.AreEqual(1, one.Terms.Count, "one set of terms, so far");

        // The till knows who to hand an evening's wage to
        var pick = (await Suite.TillAt(branch).GetAsync<List<TillEmployeeView>>($"/api/payroll/till/employees?{Suite.Version}")).Single();
        Assert.AreEqual("Mahmoud", pick.Name);
        Assert.AreEqual(0m, pick.Balance, "a daily worker's balance is the evening's pay-out, so the counter sees it");

        var (edited, detail) = await books.RefusedAsync(HttpMethod.Put, Suite.Url($"/employees/{id}"), new
        {
            name = "Mahmoud Ali", jobTitle = "Head barista", phone = "0100 222 2222", branchId = branch,
        });
        Assert.AreEqual(HttpStatusCode.OK, edited, detail);
        var renamed = await books.GetAsync<EmployeeView>(Suite.Url($"/employees/{id}"));
        Assert.AreEqual("Mahmoud Ali", renamed.Name);
        Assert.AreEqual("Head barista", renamed.JobTitle);
        Assert.AreEqual(200m, renamed.CurrentTerms!.Rate, "editing the record does not touch the pay");
    }

    [TestMethod]
    public async Task What_someone_is_paid_is_the_owners_call_and_the_old_pay_stays_as_history()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Salma", PayScheme.Monthly, 6000m);

        var (byManager, _) = await books.RefusedAsync(HttpMethod.Put, Suite.Url($"/employees/{id}/pay-terms"), new
        {
            scheme = (int)PayScheme.Monthly, rate = 9000m, effectiveFrom = "2026-04-01",
        });
        Assert.AreEqual(HttpStatusCode.Forbidden, byManager, "a branch manager hires at a wage but does not raise one");

        var (raised, detail) = await Suite.OwnerAt(branch).RefusedAsync(HttpMethod.Put, Suite.Url($"/employees/{id}/pay-terms"), new
        {
            scheme = (int)PayScheme.Monthly, rate = 7500m, effectiveFrom = "2026-04-01",
        });
        Assert.AreEqual(HttpStatusCode.OK, raised, detail);

        var after = await books.GetAsync<EmployeeView>(Suite.Url($"/employees/{id}"));
        Assert.AreEqual(2, after.Terms.Count, "what they used to be paid is not rewritten");
        Assert.AreEqual(6000m, after.Terms.Single(t => t.EffectiveFrom == new DateOnly(2026, 3, 1)).Rate);
        Assert.AreEqual(7500m, after.CurrentTerms!.Rate, "and today they are on the new pay");

        var (nothing, _) = await Suite.OwnerAt(branch).RefusedAsync(HttpMethod.Put, Suite.Url($"/employees/{id}/pay-terms"), new
        {
            scheme = (int)PayScheme.Monthly, rate = 0m, effectiveFrom = "2026-05-01",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, "nobody works for nothing");
    }

    [TestMethod]
    public async Task Someone_who_leaves_is_off_the_register_but_not_out_of_the_books()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Karim");

        await books.PostAsync<CreatedView>(Suite.Url($"/employees/{id}/ledger"), new
        {
            type = (int)LedgerEntryType.Bonus, amount = 300m, date = "2026-03-10", note = "A good month",
        });

        var (left, detail) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/employees/{id}/leave"), new { endedOn = "2026-03-31" });
        Assert.AreEqual(HttpStatusCode.OK, left, detail);

        Assert.IsEmpty(await books.GetAsync<List<EmployeeView>>(Suite.Url("/employees")), "they are off the register");
        var gone = (await books.GetAsync<List<EmployeeView>>(Suite.Url("/employees") + "&includeInactive=true")).Single();
        Assert.IsFalse(gone.IsActive);
        Assert.AreEqual(new DateOnly(2026, 3, 31), gone.EndedOn);
        Assert.AreEqual(300m, gone.Balance, "and what the café still owes them does not go away");

        Assert.IsEmpty(await Suite.TillAt(branch).GetAsync<List<TillEmployeeView>>($"/api/payroll/till/employees?{Suite.Version}"),
            "the till does not offer a wage to someone who left");

        var ledger = await books.GetAsync<LedgerView>(Suite.Url($"/employees/{id}/ledger"));
        Assert.AreEqual(300m, ledger.Balance, "their account is still there to settle");

        var (back, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/employees/{id}/rehire"), new { startedOn = "2026-06-01" });
        Assert.AreEqual(HttpStatusCode.OK, back, why);
        var rehired = (await books.GetAsync<List<EmployeeView>>(Suite.Url("/employees"))).Single();
        Assert.IsTrue(rehired.IsActive, "and someone who comes back is on the register again");
        Assert.AreEqual(new DateOnly(2026, 6, 1), rehired.StartedOn);
    }

    [TestMethod]
    public async Task What_the_register_will_not_take()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);

        var (noName, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/employees"), new
        {
            name = "  ", branchId = branch, startedOn = "2026-03-01", scheme = 0, rate = 100m,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, noName, "someone on the register has a name");

        var (noPay, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/employees"), new
        {
            name = "Nobody", branchId = branch, startedOn = "2026-03-01", scheme = 0, rate = 0m,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, noPay);

        var id = await Suite.HireAsync(books, branch, "Omar");

        var (backwards, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/employees/{id}/leave"), new { endedOn = "2026-02-01" });
        Assert.AreEqual(HttpStatusCode.BadRequest, backwards);
        Assert.Contains("before they started", why);

        var (stranger, _) = await books.RefusedAsync(HttpMethod.Get, Suite.Url("/employees/999999"));
        Assert.AreEqual(HttpStatusCode.NotFound, stranger, "somebody who was never hired is not found");

        var (nothing, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/employees/{id}/ledger"), new
        {
            type = (int)LedgerEntryType.Bonus, amount = 0m, date = "2026-03-10",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, "a line on someone's account is always some money");
    }

    [TestMethod]
    public async Task Payroll_is_the_back_offices_and_the_till_only_asks_who()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Hoda");

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Suite.Url("/employees"), null),
            (HttpMethod.Get, Suite.Url($"/employees/{id}/ledger"), null),
            (HttpMethod.Post, Suite.Url($"/employees/{id}/ledger"), new { type = 1, amount = 10m, date = "2026-03-10" }),
            (HttpMethod.Get, Suite.Url("/payslips") + "&from=2026-03-01&to=2026-03-31", null),
            (HttpMethod.Post, Suite.Url("/payslips"), new { periodStart = "2026-03-01", periodEnd = "2026-03-31" }),
        })
        {
            var (byTill, _) = await Suite.TillAt(branch).RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byTill, $"{method} {path} is not the till's");

            var (byGuest, _) = await Suite.Payroll.As(Persona.Customer(), branch).RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byGuest, $"{method} {path} is nobody else's either");
        }

        using var nobody = Suite.Payroll.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Suite.Url("/employees"))).StatusCode);

        var visiting = Suite.Payroll.As(Persona.Admin(branch), branch + 1);
        var (elsewhere, _) = await visiting.RefusedAsync(HttpMethod.Get, Suite.Url("/employees"));
        Assert.AreEqual(HttpStatusCode.Forbidden, elsewhere, "another branch's register is not theirs to read");
    }
}
