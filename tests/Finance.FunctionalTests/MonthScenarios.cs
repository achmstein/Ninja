using Microsoft.Extensions.DependencyInjection;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Finance.API.Application.IntegrationEvents.Events;
using Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;
using Ninja.Finance.Domain.AggregatesModel.PartnerAggregate;
using Ninja.Finance.Domain.AggregatesModel.SupplierAggregate;
using Ninja.Testing;

namespace Ninja.Finance.FunctionalTests;

/// <summary>What the owner's page reads off the wire; named here so a change in the API's shape fails a test.</summary>
public record ProfitView(
    int Year,
    int Month,
    decimal Sales,
    decimal Refunds,
    decimal NetSales,
    decimal Vat,
    decimal Goods,
    decimal Waste,
    decimal Labour,
    List<CategoryTotalView> ExpensesByCategory,
    decimal Expenses,
    decimal Profit,
    decimal? PrimeCostRatio,
    decimal? Margin,
    List<PartnerProfitShareView> PartnerShares);

public record PartnerProfitShareView(int PartnerId, string Name, decimal Percent, decimal Amount);
public record ProfitMonthView(int Year, int Month, decimal NetSales, decimal Goods, decimal Labour, decimal Expenses, decimal Profit);

/// <summary>
/// The month, as the owner reads it: what the till took, what the
/// storeroom and payroll say it cost, what was spent besides — and the
/// money the till moved during service, landing on the account it was for.
/// Everything but the expenses arrives as an event from another service,
/// so each scenario tells the bus and waits for the page to say so.
/// </summary>
[TestClass]
public sealed class MonthScenarios
{
    private static string ProfitUrl(int year, int month) => Suite.Url("/profit") + $"&year={year}&month={month}";

    private static Task TellAsync(IntegrationEvent what)
        => Suite.Finance.Services.GetRequiredService<IEventBus>().PublishAsync(what);

    private static DateTime Noon(int year, int month, int day) => new(year, month, day, 12, 0, 0, DateTimeKind.Utc);

    private static async Task<int> ACategoryAsync(Caller books, string named)
        => (await books.GetAsync<List<CategoryView>>(Suite.Url("/categories"))).First(c => c.Name.En == named).Id;

    [TestMethod]
    public async Task The_month_adds_up_what_the_till_the_storeroom_and_payroll_report()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var owner = Suite.OwnerAt(branch);
        var at = Noon(2026, 3, 15);

        await TellAsync(new TicketSettledIntegrationEvent { TicketId = branch * 100 + 1, BranchId = branch, Total = 1000m, Vat = 140m, CreationDate = at });
        await TellAsync(new TicketRefundedIntegrationEvent { RefundId = branch * 100 + 1, BranchId = branch, Amount = 100m, CreationDate = at });
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "Sale", Cost = 300m, At = at });
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "Waste", Cost = 50m, At = at });
        await TellAsync(new EmployeeEarningsChangedIntegrationEvent
        {
            BranchId = branch,
            EmployeeId = branch,
            PeriodStart = new DateOnly(2026, 3, 1),
            PeriodEnd = new DateOnly(2026, 3, 15),
            NetEarned = 200m,
        });

        await books.PostAsync<CreatedView>(Suite.Url("/expenses"), new
        {
            date = "2026-03-08", categoryId = await ACategoryAsync(books, "Electricity"), amount = 150m, paidFrom = (int)PaidFrom.Drawer,
        });

        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
        {
            var reported = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
            return reported is { Sales: 1000m, Refunds: 100m, Goods: 300m, Waste: 50m, Labour: 200m };
        }, "everything the other services reported reaches the month");

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(900m, month.NetSales, "what came in, less what went back");
        Assert.AreEqual(140m, month.Vat, "the tax inside the sales is carried on its own");
        Assert.AreEqual(150m, month.Expenses);
        Assert.AreEqual("Electricity", month.ExpensesByCategory.Single().CategoryName.En);
        Assert.AreEqual(200m, month.Profit, "900 in, 300 of goods, 50 wasted, 200 of wages, 150 of bills");
        Assert.AreEqual(0.5556m, month.PrimeCostRatio, "goods and labour over net sales: the ratio every café watches");
        Assert.AreEqual(0.2222m, month.Margin);

        var quiet = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 4));
        Assert.AreEqual(0m, quiet.NetSales, "a month with nothing in it is zero, not last month again");
        Assert.IsNull(quiet.Margin, "and a month that sold nothing has no margin to speak of");

        // The month is the owner's page
        var (byManager, _) = await books.RefusedAsync(HttpMethod.Get, ProfitUrl(2026, 3));
        Assert.AreEqual(System.Net.HttpStatusCode.Forbidden, byManager, "a branch manager keys in the bills; the profit is the owner's");
    }

    [TestMethod]
    public async Task A_ticket_the_bus_delivers_twice_is_counted_once()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var at = Noon(2026, 3, 12);
        var ticket = branch * 100 + 7;

        await TellAsync(new TicketSettledIntegrationEvent { TicketId = ticket, BranchId = branch, Total = 500m, Vat = 70m, CreationDate = at });
        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Sales == 500m,
            "the first telling is on the page");

        // The same bill again, and a second bill behind it: the second is the marker that both were handled
        await TellAsync(new TicketSettledIntegrationEvent { TicketId = ticket, BranchId = branch, Total = 500m, Vat = 70m, CreationDate = at });
        await TellAsync(new TicketSettledIntegrationEvent { TicketId = ticket + 1, BranchId = branch, Total = 200m, Vat = 28m, CreationDate = at });

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Sales == 700m,
            "the bill told twice is counted once, and the one behind it is counted");

        Assert.AreEqual(700m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Sales);
    }

    [TestMethod]
    public async Task The_month_falls_to_the_partners_by_their_shares()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);

        var hany = await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            name = $"Hany {branch}", shares = new[] { new { branchId = branch, percent = 60m } },
        });
        var samia = await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            name = $"Samia {branch}", shares = new[] { new { branchId = branch, percent = 40m } },
        });

        await TellAsync(new TicketSettledIntegrationEvent
        {
            TicketId = branch * 100 + 3, BranchId = branch, Total = 1000m, Vat = 140m, CreationDate = Noon(2026, 3, 9),
        });

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Profit == 1000m,
            "a month with nothing spent in it is all profit");

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(2, month.PartnerShares.Count);
        Assert.AreEqual(600m, month.PartnerShares.Single(p => p.PartnerId == hany.Id).Amount, "sixty percent of the month");
        Assert.AreEqual(400m, month.PartnerShares.Single(p => p.PartnerId == samia.Id).Amount);
        Assert.AreEqual(40m, month.PartnerShares.Single(p => p.PartnerId == samia.Id).Percent);
    }

    [TestMethod]
    public async Task Money_the_till_moved_lands_on_the_account_it_was_for()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var owner = Suite.OwnerAt(branch);
        var shift = branch * 10;
        var openedAt = Noon(2026, 3, 18);

        var dairy = await books.PostAsync<CreatedView>(Suite.Url("/suppliers"), new { name = $"The dairy {branch}" });
        var partner = await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            name = $"Nour {branch}", shares = new[] { new { branchId = branch, percent = 50m } },
        });
        var maintenance = await ACategoryAsync(books, "Maintenance");

        async Task MoveAsync(int movement, string type, string kind, decimal amount, string reason, int? supplierId = null, int? partnerId = null, int? categoryId = null)
            => await TellAsync(new CashMovedIntegrationEvent
            {
                ShiftId = shift,
                MovementId = movement,
                BranchId = branch,
                Type = type,
                Kind = kind,
                Amount = amount,
                Reason = reason,
                SupplierId = supplierId,
                PartnerId = partnerId,
                CategoryId = categoryId,
                ShiftOpenedAt = openedAt,
                RecordedBy = "Cashier",
            });

        await MoveAsync(1, "PayOut", "Supplier", 350m, "Milk", supplierId: dairy.Id);
        await MoveAsync(2, "PayOut", "Expense", 90m, "A new tap", categoryId: maintenance);
        await MoveAsync(3, "PayIn", "Partner", 1000m, "Change for the drawer", partnerId: partner.Id);
        await MoveAsync(4, "PayOut", "Other", 25m, "A taxi");

        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
        {
            var supplier = await books.GetAsync<SupplierLedgerView>(Suite.Url($"/suppliers/{dairy.Id}/ledger"));
            var pocket = await owner.GetAsync<PartnerLedgerView>(Suite.Url($"/partners/{partner.Id}/ledger"));
            var march = await books.GetAsync<ExpensesView>(Suite.Url("/expenses") + "&from=2026-03-01&to=2026-03-31");
            return supplier.Balance == -350m && pocket.Balance == 1000m && march.Total == 90m;
        }, "what the till moved is on the accounts it named");

        var paid = (await books.GetAsync<SupplierLedgerView>(Suite.Url($"/suppliers/{dairy.Id}/ledger"))).Entries.Single();
        Assert.AreEqual(SupplierEntryType.Payment, paid.Type, "money handed over the counter is a payment on their account");
        Assert.AreEqual(FinanceSource.Till, paid.Source);
        Assert.AreEqual($"shift:{shift}:movement:1", paid.Reference, "and the movement that paid it can be found again");
        Assert.AreEqual(new DateOnly(2026, 3, 18), paid.Date, "dated to the business day the shift opened on");

        var expense = (await books.GetAsync<ExpensesView>(Suite.Url("/expenses") + "&from=2026-03-01&to=2026-03-31")).Expenses.Single();
        Assert.AreEqual(FinanceSource.Till, expense.Source);
        Assert.AreEqual(PaidFrom.Drawer, expense.PaidFrom, "it came out of the drawer, because the till is the drawer");
        Assert.AreEqual("A new tap", expense.Note);

        var put = (await owner.GetAsync<PartnerLedgerView>(Suite.Url($"/partners/{partner.Id}/ledger"))).Entries.Single();
        Assert.AreEqual(PartnerEntryType.Contribution, put.Type, "money a partner puts into the drawer is theirs still");

        // The taxi named nothing Finance keeps an account for, and nothing was invented for it
        Assert.AreEqual(1, (await books.GetAsync<ExpensesView>(Suite.Url("/expenses") + "&from=2026-03-01&to=2026-03-31")).Expenses.Count);

        // The bus delivering the pay-out again pays nobody twice
        await MoveAsync(1, "PayOut", "Supplier", 350m, "Milk", supplierId: dairy.Id);
        await MoveAsync(5, "PayOut", "Supplier", 10m, "A late crate", supplierId: dairy.Id);
        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await books.GetAsync<SupplierLedgerView>(Suite.Url($"/suppliers/{dairy.Id}/ledger"))).Balance == -360m,
            "the movement told twice is one line, and the one behind it is another");
    }

    [TestMethod]
    public async Task The_trend_is_the_last_months_headline_figures_newest_first()
    {
        var branch = Suite.NewBranch();
        var books = Suite.BackOfficeAt(branch);
        var owner = Suite.OwnerAt(branch);

        var trend = await owner.GetAsync<List<ProfitMonthView>>(Suite.Url("/profit/trend") + "&months=3");
        Assert.AreEqual(3, trend.Count);
        var now = trend[0];
        Assert.AreEqual(0m, now.NetSales, "a branch that has sold nothing has an empty month");

        for (var i = 1; i < trend.Count; i++)
        {
            var older = new DateOnly(now.Year, now.Month, 1).AddMonths(-i);
            Assert.AreEqual(older.Year, trend[i].Year, "newest first, one month at a time");
            Assert.AreEqual(older.Month, trend[i].Month);
        }

        // Put a day's trade into the month the trend is standing in
        await TellAsync(new TicketSettledIntegrationEvent
        {
            TicketId = branch * 100 + 5, BranchId = branch, Total = 800m, Vat = 112m, CreationDate = Noon(now.Year, now.Month, 15),
        });
        await books.PostAsync<CreatedView>(Suite.Url("/expenses"), new
        {
            date = $"{now.Year:0000}-{now.Month:00}-15",
            categoryId = await ACategoryAsync(books, "Marketing"),
            amount = 100m,
            paidFrom = (int)PaidFrom.Drawer,
        });

        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
        {
            var again = await owner.GetAsync<List<ProfitMonthView>>(Suite.Url("/profit/trend") + "&months=3");
            return again[0].NetSales == 800m;
        }, "the month the café is in shows what it has taken so far");

        var latest = (await owner.GetAsync<List<ProfitMonthView>>(Suite.Url("/profit/trend") + "&months=3"))[0];
        Assert.AreEqual(100m, latest.Expenses);
        Assert.AreEqual(700m, latest.Profit, "the headline the dashboard draws");
    }
}
