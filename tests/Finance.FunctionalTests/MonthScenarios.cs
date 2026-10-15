using Microsoft.Extensions.DependencyInjection;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Finance.API.Application.IntegrationEvents.EventHandling;
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
    List<PartnerProfitShareView> PartnerShares,
    decimal RefundVat,
    decimal NetVat,
    decimal NetSalesExVat,
    decimal Shrinkage);

public record PartnerProfitShareView(int PartnerId, string Name, decimal Percent, decimal Amount);
public record ProfitMonthView(int Year, int Month, decimal NetSales, decimal Goods, decimal Labour, decimal Expenses, decimal Profit, decimal NetSalesExVat);

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
        await TellAsync(new TicketRefundedIntegrationEvent { RefundId = branch * 100 + 1, TicketId = branch * 100 + 1, BranchId = branch, Amount = 100m, CreationDate = at });
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
            // The refund's VAT is there once both the sale and the refund are, in whichever order they came
            return reported is { Sales: 1000m, Refunds: 100m, RefundVat: 14m, Goods: 300m, Waste: 50m, Labour: 200m };
        }, "everything the other services reported reaches the month");

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(900m, month.NetSales, "what came in, less what went back, as the customers paid it");
        Assert.AreEqual(140m, month.Vat, "the tax inside the sales is carried on its own");
        Assert.AreEqual(14m, month.RefundVat, "a tenth of the bill went back, and a tenth of its tax with it");
        Assert.AreEqual(126m, month.NetVat, "what the month owes the tax office");
        Assert.AreEqual(774m, month.NetSalesExVat, "what the business earned: 900 taken, 126 of it the tax office's");
        Assert.AreEqual(150m, month.Expenses);
        Assert.AreEqual("Electricity", month.ExpensesByCategory.Single().CategoryName.En);
        // Profit and the ratios are worked from net sales without the VAT: tax
        // collected for the state is nobody's profit
        Assert.AreEqual(74m, month.Profit, "774 earned, 300 of goods, 50 wasted, 200 of wages, 150 of bills");
        Assert.AreEqual(0.6460m, month.PrimeCostRatio, "goods and labour over net sales without VAT: the ratio every business watches");
        Assert.AreEqual(0.0956m, month.Margin);

        var quiet = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 4));
        Assert.AreEqual(0m, quiet.NetSales, "a month with nothing in it is zero, not last month again");
        Assert.IsNull(quiet.Margin, "and a month that sold nothing has no margin to speak of");

        // The month is the owner's page
        var (byManager, _) = await books.RefusedAsync(HttpMethod.Get, ProfitUrl(2026, 3));
        Assert.AreEqual(System.Net.HttpStatusCode.Forbidden, byManager, "a branch manager keys in the bills; the profit is the owner's");
    }

    [TestMethod]
    public async Task An_order_never_sold_takes_its_cost_out_of_goods_and_made_food_lands_in_waste()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var at = Noon(2026, 2, 10);

        // Two orders' sales; one cancelled before the kitchen made it, the
        // other voided after it was made
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "Sale", Cost = 300m, At = at });
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "Sale", Cost = 100m, At = at });
        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
            (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 2))).Goods == 400m, "both sales cost their goods first");

        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "SaleReversal", Cost = 300m, At = at });
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "SaleReversal", Cost = 100m, At = at });
        await TellAsync(new StockConsumedIntegrationEvent { BranchId = branch, Kind = "Waste", Cost = 100m, At = at });

        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
        {
            var reported = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 2));
            return reported is { Goods: 0m, Waste: 100m };
        }, "the sales given back leave the goods, and the made one is waste");

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 2));
        Assert.AreEqual(-100m, month.Profit, "nothing sold; the food made and thrown away is the loss");
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
    public async Task A_sale_an_offline_till_sends_late_lands_on_the_day_it_was_paid()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);

        // Paid on the last evening of April, reaching Finance on the first of May
        await TellAsync(new TicketSettledIntegrationEvent
        {
            TicketId = branch * 100 + 9,
            BranchId = branch,
            Total = 300m,
            Vat = 42m,
            SettledAt = Noon(2026, 4, 30),
            CreationDate = Noon(2026, 5, 1),
        });

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 4))).Sales == 300m,
            "the sale is April's, when the cash changed hands");

        Assert.AreEqual(0m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 5))).Sales, "nothing of it is May's");
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
            async () => (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Profit == 860m,
            "a month with nothing spent in it is all profit, the VAT inside the sale aside");

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(2, month.PartnerShares.Count);
        Assert.AreEqual(516m, month.PartnerShares.Single(p => p.PartnerId == hany.Id).Amount, "sixty percent of what the month earned");
        Assert.AreEqual(344m, month.PartnerShares.Single(p => p.PartnerId == samia.Id).Amount);
        Assert.AreEqual(40m, month.PartnerShares.Single(p => p.PartnerId == samia.Id).Percent);

        // The branch is all given out: a third partner's share would make it more than whole
        var (refused, detail) = await owner.RefusedAsync(HttpMethod.Post, Suite.Url("/partners"), new
        {
            name = $"Late {branch}", shares = new[] { new { branchId = branch, percent = 10m } },
        });
        Assert.AreEqual(System.Net.HttpStatusCode.BadRequest, refused);
        StringAssert.Contains(detail, "110%");

        // Samia stepping down frees her forty
        await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            id = samia.Id, name = $"Samia {branch}", shares = new[] { new { branchId = branch, percent = 40m } }, isActive = false,
        });
        await owner.PostAsync<CreatedView>(Suite.Url("/partners"), new
        {
            name = $"Late {branch}", shares = new[] { new { branchId = branch, percent = 40m } },
        });
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
        }, "the month the business is in shows what it has taken so far");

        var latest = (await owner.GetAsync<List<ProfitMonthView>>(Suite.Url("/profit/trend") + "&months=3"))[0];
        Assert.AreEqual(100m, latest.Expenses);
        Assert.AreEqual(688m, latest.NetSalesExVat, "800 taken, 112 of it VAT");
        Assert.AreEqual(588m, latest.Profit, "the headline the dashboard draws: earned without the VAT, less the bills");
    }

    private static async Task HandleAsync<THandler, TEvent>(TEvent what)
        where THandler : IIntegrationEventHandler<TEvent>
        where TEvent : IntegrationEvent
    {
        // Straight to the handler, in this order: the bus may hand two messages to two consumers at once
        using var scope = Suite.Finance.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<THandler>(scope.ServiceProvider).Handle(what);
    }

    [TestMethod]
    public async Task A_branch_whose_day_starts_at_five_in_the_afternoon_books_a_sale_on_its_own_day()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);

        await HandleAsync<BranchSettingsChangedIntegrationEventHandler, BranchSettingsChangedIntegrationEvent>(new()
        {
            BranchId = branch, DayStartTime = new TimeOnly(17, 0), Version = DateTime.UtcNow.Ticks,
        });

        // Cairo is two hours ahead in March. Half past four on the 1st is still
        // the last day of February there; ten past five is March's first. A
        // 06:00 cutoff would have put both in March
        await HandleAsync<TicketSettledIntegrationEventHandler, TicketSettledIntegrationEvent>(new()
        {
            TicketId = branch * 100 + 1, BranchId = branch, Total = 100m, SettledAt = new DateTime(2026, 3, 1, 14, 30, 0, DateTimeKind.Utc),
        });
        await HandleAsync<TicketSettledIntegrationEventHandler, TicketSettledIntegrationEvent>(new()
        {
            TicketId = branch * 100 + 2, BranchId = branch, Total = 200m, SettledAt = new DateTime(2026, 3, 1, 15, 10, 0, DateTimeKind.Utc),
        });
        // The night's last sale, at one in the morning of the 1st, is the 28th's too
        await HandleAsync<StockConsumedIntegrationEventHandler, StockConsumedIntegrationEvent>(new()
        {
            BranchId = branch, Kind = "Sale", Cost = 40m, At = new DateTime(2026, 2, 28, 23, 0, 0, DateTimeKind.Utc),
        });

        var february = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 2));
        var march = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(100m, february.Sales, "before five the day is still yesterday's");
        Assert.AreEqual(40m, february.Goods);
        Assert.AreEqual(200m, march.Sales, "from five it is the new day's");

        // A stale settings event, from before the change, leaves the day where it is
        await HandleAsync<BranchSettingsChangedIntegrationEventHandler, BranchSettingsChangedIntegrationEvent>(new()
        {
            BranchId = branch, DayStartTime = new TimeOnly(6, 0), Version = DateTime.UtcNow.AddHours(-1).Ticks,
        });
        await HandleAsync<TicketSettledIntegrationEventHandler, TicketSettledIntegrationEvent>(new()
        {
            TicketId = branch * 100 + 3, BranchId = branch, Total = 50m, SettledAt = new DateTime(2026, 3, 1, 14, 45, 0, DateTimeKind.Utc),
        });
        Assert.AreEqual(150m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 2))).Sales);
    }

    [TestMethod]
    public async Task A_refund_that_arrives_before_its_sale_gets_its_vat_when_the_sale_does()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var ticket = branch * 100 + 4;
        var at = Noon(2026, 3, 20);

        await HandleAsync<TicketRefundedIntegrationEventHandler, TicketRefundedIntegrationEvent>(new()
        {
            RefundId = branch * 100 + 4, TicketId = ticket, BranchId = branch, Amount = 114m, CreationDate = at,
        });
        Assert.AreEqual(0m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).RefundVat, "no sale yet to take its share from");

        await HandleAsync<TicketSettledIntegrationEventHandler, TicketSettledIntegrationEvent>(new()
        {
            TicketId = ticket, BranchId = branch, Total = 1140m, Vat = 140m, SettledAt = at,
        });

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(1026m, month.NetSales);
        Assert.AreEqual(14m, month.RefundVat, "114 of 1140 went back: a tenth of the 140 of VAT");
        Assert.AreEqual(126m, month.NetVat);
        Assert.AreEqual(900m, month.NetSalesExVat, "(1140 − 114) − (140 − 14)");
        Assert.AreEqual(900m, month.Profit);
        Assert.AreEqual(1m, month.Margin, "nothing spent: all of what was earned is profit");
    }

    [TestMethod]
    public async Task Labour_is_each_payslips_cost_shared_out_by_days_and_a_stale_figure_never_undoes_a_newer()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var employee = branch;
        var payslip = branch * 10;
        var noon = Noon(2026, 4, 19);

        // A pay cycle from the 20th to the 19th: thirty-one days, twelve of them March's
        await HandleAsync<EmployeeEarningsChangedIntegrationEventHandler, EmployeeEarningsChangedIntegrationEvent>(new()
        {
            BranchId = branch, EmployeeId = employee, PayslipId = payslip,
            PeriodStart = new DateOnly(2026, 3, 20), PeriodEnd = new DateOnly(2026, 4, 19),
            NetEarned = 3000m, LabourCost = 3100m, CreationDate = noon,
        });
        // The next cycle, its first eleven days April's
        await HandleAsync<EmployeeEarningsChangedIntegrationEventHandler, EmployeeEarningsChangedIntegrationEvent>(new()
        {
            BranchId = branch, EmployeeId = employee, PayslipId = payslip + 1,
            PeriodStart = new DateOnly(2026, 4, 20), PeriodEnd = new DateOnly(2026, 5, 19),
            NetEarned = 3000m, LabourCost = 3000m, CreationDate = noon,
        });

        Assert.AreEqual(1200m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Labour, "twelve days of 3100 over thirty-one");
        Assert.AreEqual(3000m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 4))).Labour, "nineteen days of one cycle, eleven of the next");

        // The bus crossed two of the first payslip's figures: the newer (a
        // bonus added) is handled first, the older arrives after it
        await HandleAsync<EmployeeEarningsChangedIntegrationEventHandler, EmployeeEarningsChangedIntegrationEvent>(new()
        {
            BranchId = branch, EmployeeId = employee, PayslipId = payslip,
            PeriodStart = new DateOnly(2026, 3, 20), PeriodEnd = new DateOnly(2026, 4, 19),
            NetEarned = 3000m, LabourCost = 6200m, CreationDate = noon.AddHours(2),
        });
        await HandleAsync<EmployeeEarningsChangedIntegrationEventHandler, EmployeeEarningsChangedIntegrationEvent>(new()
        {
            BranchId = branch, EmployeeId = employee, PayslipId = payslip,
            PeriodStart = new DateOnly(2026, 3, 20), PeriodEnd = new DateOnly(2026, 4, 19),
            NetEarned = 3000m, LabourCost = 3100m, CreationDate = noon.AddHours(1),
        });

        Assert.AreEqual(2400m, (await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3))).Labour, "the newest figure stands");
    }

    [TestMethod]
    public async Task Stock_a_count_found_missing_is_a_cost_and_stock_found_over_takes_it_back()
    {
        var branch = Suite.NewBranch();
        var owner = Suite.OwnerAt(branch);
        var at = Noon(2026, 3, 25);

        await HandleAsync<TicketSettledIntegrationEventHandler, TicketSettledIntegrationEvent>(new()
        {
            TicketId = branch * 100 + 6, BranchId = branch, Total = 500m, SettledAt = at,
        });
        await HandleAsync<StockConsumedIntegrationEventHandler, StockConsumedIntegrationEvent>(new()
        {
            BranchId = branch, Kind = "Shrinkage", Cost = 30m, At = at,
        });
        await HandleAsync<StockConsumedIntegrationEventHandler, StockConsumedIntegrationEvent>(new()
        {
            BranchId = branch, Kind = "ShrinkageFound", Cost = 10m, At = at,
        });

        var month = await owner.GetAsync<ProfitView>(ProfitUrl(2026, 3));
        Assert.AreEqual(20m, month.Shrinkage, "thirty gone, ten of it found again");
        Assert.AreEqual(480m, month.Profit);
        Assert.AreEqual(20m, (await owner.GetAsync<List<ProfitMonthView>>(Suite.Url("/profit/trend") + "&months=12"))
            .Single(m => m is { Year: 2026, Month: 3 }).Goods, "the trend's goods are everything the stock cost");
    }
}
