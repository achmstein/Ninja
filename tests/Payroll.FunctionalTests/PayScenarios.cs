using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Payroll.API.Application.IntegrationEvents.Events;
using Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;
using Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Ninja.Payroll.Domain.AggregatesModel.LedgerAggregate;
using Ninja.Payroll.Domain.AggregatesModel.PayslipAggregate;
using Ninja.Testing;

namespace Ninja.Payroll.FunctionalTests;

/// <summary>
/// What the café owes someone and how it is settled: the ledger, the
/// payslip that adds a period up, the wage the till already handed over.
/// </summary>
[TestClass]
public sealed class PayScenarios
{
    private static Task TellAsync(IntegrationEvent what)
        => Suite.Payroll.Services.GetRequiredService<IEventBus>().PublishAsync(what);

    private static async Task PresentAsync(Caller books, int employee, params string[] days)
    {
        foreach (var day in days)
        {
            var (marked, detail) = await books.RefusedAsync(HttpMethod.Put, Suite.Url($"/attendance/{day}"), new
            {
                marks = new object[] { new { employeeId = employee, status = (int)AttendanceStatus.Present } },
            });
            Assert.AreEqual(HttpStatusCode.OK, marked, detail);
        }
    }

    private static Task<CreatedView> PostAsync(Caller books, int employee, LedgerEntryType type, decimal amount, string date, string? note = null)
        => books.PostAsync<CreatedView>(Suite.Url($"/employees/{employee}/ledger"), new { type = (int)type, amount, date, note });

    private static Task<LedgerView> LedgerAsync(Caller books, int employee) => books.GetAsync<LedgerView>(Suite.Url($"/employees/{employee}/ledger"));

    private static Task<GeneratedView> GenerateAsync(Caller books, int? employee, string from, string to)
        => books.PostAsync<GeneratedView>(Suite.Url("/payslips"), new { employeeId = employee, periodStart = from, periodEnd = to });

    [TestMethod]
    public async Task What_the_cafe_owes_someone_is_the_ledger_line_by_line()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Rania");

        await PostAsync(books, id, LedgerEntryType.Bonus, 300m, "2026-03-05", "A good week");
        await PostAsync(books, id, LedgerEntryType.Deduction, 50m, "2026-03-06", "A broken glass");
        await PostAsync(books, id, LedgerEntryType.Advance, 100m, "2026-03-20", "Asked for on the 20th");

        var ledger = await LedgerAsync(books, id);
        Assert.AreEqual(150m, ledger.Balance, "three hundred earned in goodwill, fifty off, a hundred handed over");
        Assert.AreEqual(3, ledger.Entries.Count);
        Assert.AreEqual(new DateOnly(2026, 3, 20), ledger.Entries.First().Date, "newest first");

        var bonus = ledger.Entries.Single(e => e.Type == LedgerEntryType.Bonus);
        Assert.AreEqual(300m, bonus.Amount, "a line is always a positive amount");
        Assert.AreEqual(300m, bonus.Signed, "and its type says which way it goes");
        Assert.AreEqual(-50m, ledger.Entries.Single(e => e.Type == LedgerEntryType.Deduction).Signed);
        Assert.AreEqual(-100m, ledger.Entries.Single(e => e.Type == LedgerEntryType.Advance).Signed);
        Assert.AreEqual(LedgerSource.Manual, bonus.Source, "keyed in by hand, not by a payslip or the till");
        Assert.AreEqual("Admin", bonus.RecordedBy);

        // The range trims the list; the balance is always the whole account
        var week = await books.GetAsync<LedgerView>(Suite.Url($"/employees/{id}/ledger") + "&from=2026-03-01&to=2026-03-10");
        Assert.AreEqual(2, week.Entries.Count);
        Assert.AreEqual(150m, week.Balance, "what someone is owed is not a matter of which page you are on");

        var (stranger, _) = await books.RefusedAsync(HttpMethod.Get, Suite.Url("/employees/999999/ledger"));
        Assert.AreEqual(HttpStatusCode.NotFound, stranger);
    }

    [TestMethod]
    public async Task A_payslip_adds_up_the_days_worked_and_what_the_ledger_says()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Yasmin", PayScheme.Daily, 200m);

        await PresentAsync(books, id, "2026-03-02", "2026-03-03", "2026-03-04");
        await PostAsync(books, id, LedgerEntryType.Bonus, 100m, "2026-03-05");
        await PostAsync(books, id, LedgerEntryType.Advance, 50m, "2026-03-06");

        // Marking a day already keeps the month's draft current, so the page is never stale
        var standing = await books.GetAsync<List<PayslipView>>(Suite.Url("/payslips") + "&from=2026-03-01&to=2026-03-31");
        Assert.AreEqual(1, standing.Count, "the month has a draft before anyone asks for one");

        var generated = await GenerateAsync(books, id, "2026-03-01", "2026-03-31");
        Assert.AreEqual(standing.Single().Id, generated.Ids.Single(), "and asking for it makes that one again, not a second");
        var payslip = await books.GetAsync<PayslipView>(Suite.Url($"/payslips/{generated.Ids.Single()}"));

        Assert.AreEqual("Yasmin", payslip.EmployeeName);
        Assert.AreEqual(PayslipStatus.Draft, payslip.Status, "a payslip is a draft until the money is handed over");
        Assert.AreEqual(3m, payslip.DaysWorked);
        Assert.AreEqual(600m, payslip.Earned, "three days at two hundred");
        Assert.AreEqual(100m, payslip.Bonuses);
        Assert.AreEqual(50m, payslip.Advances);
        Assert.AreEqual(0m, payslip.CarriedOver, "nothing was owed before the period");
        Assert.AreEqual(650m, payslip.AmountDue, "six hundred earned, a hundred on top, fifty already taken");
        Assert.AreEqual(650m, payslip.Remaining);

        var ledger = await LedgerAsync(books, id);
        Assert.AreEqual(650m, ledger.Balance, "the period's earnings are on the account, not only on the paper");
        var earned = ledger.Entries.Single(e => e.Type == LedgerEntryType.Earned);
        Assert.AreEqual(600m, earned.Amount);
        Assert.AreEqual(LedgerSource.Payslip, earned.Source);
        Assert.AreEqual(new DateOnly(2026, 3, 31), earned.Date, "dated to the end of the period it paid for");
        Assert.Contains("3 × 200", earned.Note!, "and the line shows its arithmetic");

        var (paid, detail) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/payslips/{payslip.Id}/pay"), new { amount = (decimal?)null, note = "Handed over" });
        Assert.AreEqual(HttpStatusCode.OK, paid, detail);

        var settled = await books.GetAsync<PayslipView>(Suite.Url($"/payslips/{payslip.Id}"));
        Assert.AreEqual(PayslipStatus.Paid, settled.Status);
        Assert.AreEqual(650m, settled.PaidAmount, "paying with no figure hands over what is owed");
        Assert.AreEqual("Admin", settled.PaidBy);

        var after = await LedgerAsync(books, id);
        Assert.AreEqual(0m, after.Balance, "and the account is square");
        Assert.AreEqual(650m, after.Entries.Single(e => e.Type == LedgerEntryType.Payment).Amount);

        var (twice, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/payslips/{payslip.Id}/pay"), new { amount = 650m });
        Assert.AreEqual(HttpStatusCode.BadRequest, twice, "nobody is paid the same month twice");
        Assert.Contains("already paid", why);
    }

    [TestMethod]
    public async Task A_draft_is_made_again_while_the_month_runs_and_dropped_if_it_was_never_right()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Fady", PayScheme.Daily, 150m);

        await PresentAsync(books, id, "2026-03-02", "2026-03-03");
        var first = (await GenerateAsync(books, id, "2026-03-01", "2026-03-31")).Ids.Single();
        Assert.AreEqual(300m, (await books.GetAsync<PayslipView>(Suite.Url($"/payslips/{first}"))).Earned);

        await PresentAsync(books, id, "2026-03-04");
        var again = (await GenerateAsync(books, id, "2026-03-01", "2026-03-31")).Ids.Single();
        Assert.AreEqual(first, again, "the month has one payslip, made again");

        var redone = await books.GetAsync<PayslipView>(Suite.Url($"/payslips/{first}"));
        Assert.AreEqual(450m, redone.Earned, "the day marked since is in it");
        Assert.AreEqual(450m, (await LedgerAsync(books, id)).Balance, "and the account is not paid the first figure as well");

        var (dropped, detail) = await books.RefusedAsync(HttpMethod.Delete, Suite.Url($"/payslips/{first}"));
        Assert.AreEqual(HttpStatusCode.OK, dropped, detail);
        var (gone, _) = await books.RefusedAsync(HttpMethod.Get, Suite.Url($"/payslips/{first}"));
        Assert.AreEqual(HttpStatusCode.NotFound, gone);
        Assert.AreEqual(0m, (await LedgerAsync(books, id)).Balance, "dropping the draft takes its earnings off the account too");

        // Made once more and paid, the month is closed
        var last = (await GenerateAsync(books, id, "2026-03-01", "2026-03-31")).Ids.Single();
        await books.RefusedAsync(HttpMethod.Post, Suite.Url($"/payslips/{last}/pay"), new { amount = (decimal?)null });

        var (frozen, why) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/payslips"), new
        {
            employeeId = id, periodStart = "2026-03-01", periodEnd = "2026-03-31",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, frozen, "a paid month is not worked out again");
        Assert.Contains("correction on the ledger", why);

        var (kept, _) = await books.RefusedAsync(HttpMethod.Delete, Suite.Url($"/payslips/{last}"));
        Assert.AreEqual(HttpStatusCode.BadRequest, kept, "and a paid payslip is not deleted");

        var (backwards, _) = await books.RefusedAsync(HttpMethod.Post, Suite.Url("/payslips"), new
        {
            employeeId = id, periodStart = "2026-04-30", periodEnd = "2026-04-01",
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, backwards, "a period cannot end before it starts");
    }

    [TestMethod]
    public async Task The_branchs_payslips_are_made_in_one_go_and_listed_for_the_month()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var amira = await Suite.HireAsync(books, branch, "Amira", PayScheme.Monthly, 6000m);
        var bassem = await Suite.HireAsync(books, branch, "Bassem", PayScheme.Daily, 100m);

        await PresentAsync(books, bassem, "2026-03-02", "2026-03-03");

        var made = await GenerateAsync(books, null, "2026-03-01", "2026-03-31");
        Assert.AreEqual(2, made.Ids.Count, "everyone at the branch gets the month worked out");

        var month = await books.GetAsync<List<PayslipView>>(Suite.Url("/payslips") + "&from=2026-03-01&to=2026-03-31");
        Assert.AreEqual(2, month.Count);
        Assert.AreEqual("Amira", month.First().EmployeeName, "in the order a page reads them");

        var salary = month.Single(p => p.EmployeeId == amira);
        Assert.AreEqual(6000m, salary.Earned, "a salary is the month, marked days or not");
        Assert.AreEqual(PayScheme.Monthly, salary.Scheme);

        var daily = month.Single(p => p.EmployeeId == bassem);
        Assert.AreEqual(200m, daily.Earned, "two days at a hundred");

        Assert.IsEmpty(await books.GetAsync<List<PayslipView>>(Suite.Url("/payslips") + "&from=2026-05-01&to=2026-05-31"),
            "a month nobody has worked out yet is empty");

        Assert.IsEmpty(await Suite.BackOfficeAt(Suite.NewBranch()).GetAsync<List<PayslipView>>(Suite.Url("/payslips") + "&from=2026-03-01&to=2026-03-31"),
            "and another branch's payroll is not this one's");
    }

    [TestMethod]
    public async Task A_wage_the_till_handed_over_is_already_on_the_account()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var id = await Suite.HireAsync(books, branch, "Sherif", PayScheme.Daily, 200m);
        var shift = branch * 10 + 5;

        await PresentAsync(books, id, "2026-03-02", "2026-03-03");

        Task HandOverAsync(int movement, string kind, decimal amount, int? employee = null) => TellAsync(new CashPaidOutIntegrationEvent
        {
            ShiftId = shift,
            MovementId = movement,
            BranchId = branch,
            Kind = kind,
            EmployeeId = employee ?? id,
            Amount = amount,
            Reason = kind == "Wage" ? "The evening's wage" : "Asked for an advance",
            ShiftOpenedAt = new DateTime(2026, 3, 3, 16, 0, 0, DateTimeKind.Utc),
            PaidAt = new DateTime(2026, 3, 3, 23, 0, 0, DateTimeKind.Utc),
            RecordedBy = "Cashier",
        });

        await HandOverAsync(1, "Wage", 300m);
        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await LedgerAsync(books, id)).Entries.Any(e => e.Type == LedgerEntryType.Payment),
            "money out of the drawer reaches the account it was for");

        var wage = (await LedgerAsync(books, id)).Entries.Single(e => e.Type == LedgerEntryType.Payment);
        Assert.AreEqual(300m, wage.Amount);
        Assert.AreEqual(LedgerSource.TillPayOut, wage.Source, "the counter paid it, not the back office");
        Assert.AreEqual($"shift:{shift}:movement:1", wage.Reference);
        Assert.AreEqual(new DateOnly(2026, 3, 3), wage.Date, "dated to the business day the shift opened on");

        await HandOverAsync(2, "Advance", 50m);
        await HandOverAsync(1, "Wage", 300m);
        await HandOverAsync(3, "Wage", 10m);

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await LedgerAsync(books, id)).Entries.Count(e => e.Source == LedgerSource.TillPayOut) == 3,
            "the pay-out told twice is one line, and the ones behind it are their own");

        var ledger = await LedgerAsync(books, id);
        Assert.AreEqual(50m, ledger.Entries.Single(e => e.Type == LedgerEntryType.Advance).Amount);
        Assert.AreEqual(40m, ledger.Balance, "four hundred worked, three hundred and ten paid, fifty advanced");

        // The till's pay-out puts the month's draft on the page by itself
        var month = (await books.GetAsync<List<PayslipView>>(Suite.Url("/payslips") + "&from=2026-03-01&to=2026-03-31")).Single();
        Assert.AreEqual(400m, month.Earned);
        Assert.AreEqual(310m, month.Payments, "what the drawer handed over during the month is on it");
        Assert.AreEqual(50m, month.Advances);
        Assert.AreEqual(40m, month.AmountDue, "so paying the payslip hands over what is left, not the whole wage again");

        // The till's picker shows a daily worker what they are owed tonight
        var pick = (await Suite.TillAt(branch).GetAsync<List<TillEmployeeView>>($"/api/payroll/till/employees?{Suite.Version}")).Single();
        Assert.AreEqual(40m, pick.Balance);
    }
}
