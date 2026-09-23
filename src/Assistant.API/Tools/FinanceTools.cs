using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

[McpServerToolType]
public sealed class FinanceTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    [McpServerTool(Name = "get_profit", Title = "Monthly profit", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The month's profit and loss: sales, refunds, net sales, VAT, cost of goods, waste, labour, expenses by category, profit, prime-cost ratio (goods + labour over net sales), margin, and the partners' shares. Use for 'did we make money', 'margin', 'prime cost', 'how much did labour cost'. One calendar month at a time.")]
    public async Task<CallToolResult> GetProfit(
        [Description("this_month, last_month, or a month as yyyy-MM")] string month = "this_month",
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        int year, monthNumber;
        try { (year, monthNumber) = PeriodResolver.ResolveMonth(month, snap!.Zone, clock.GetUtcNow()); }
        catch (PeriodException ex) { return ToolResults.Fail(ex.Message); }

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<ProfitView>("finance-api", $"/api/finance/profit?year={year}&month={monthNumber}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var views = fan.Ok.Select(x => x.Value).ToList();
        var netSales = views.Sum(v => v.NetSales);
        var goods = views.Sum(v => v.Goods);
        var labour = views.Sum(v => v.Labour);
        var profit = views.Sum(v => v.Profit);
        return ToolResults.Ok(new
        {
            month = $"{year:0000}-{monthNumber:00}",
            currency = snap!.Currency,
            total = new
            {
                sales = views.Sum(v => v.Sales),
                refunds = views.Sum(v => v.Refunds),
                netSales,
                vat = views.Sum(v => v.Vat),
                goods,
                waste = views.Sum(v => v.Waste),
                labour,
                expenses = views.Sum(v => v.Expenses),
                profit,
                primeCostRatio = netSales == 0 ? null : (decimal?)Math.Round((goods + labour) / netSales, 3),
                margin = netSales == 0 ? null : (decimal?)Math.Round(profit / netSales, 3),
                expensesByCategory = views.SelectMany(v => v.ExpensesByCategory ?? [])
                    .GroupBy(c => c.CategoryName?.Display ?? c.CategoryId.ToString(System.Globalization.CultureInfo.InvariantCulture))
                    .Select(g => new { category = g.Key, total = g.Sum(c => c.Total) })
                    .OrderByDescending(c => c.total),
            },
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                x.Value.NetSales,
                x.Value.Goods,
                x.Value.Waste,
                x.Value.Labour,
                x.Value.Expenses,
                x.Value.Profit,
                x.Value.PrimeCostRatio,
                x.Value.Margin,
                partnerShares = x.Value.PartnerShares?.Select(s => new { s.Name, s.Percent, s.Amount }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_profit_trend", Title = "Profit trend", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Profit month by month for the last N months: net sales, cost of goods, labour, expenses and profit per month. Use for 'is profit improving', 'compare months', 'trend this year'.")]
    public async Task<CallToolResult> GetProfitTrend(
        [Description("How many months back, 1-24")] int months = 6,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        months = Math.Clamp(months, 1, 24);
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<ProfitMonthView>>("finance-api", $"/api/finance/profit/trend?months={months}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            months = fan.Ok.SelectMany(x => x.Value).GroupBy(m => (m.Year, m.Month))
                .Select(g => new
                {
                    month = $"{g.Key.Year:0000}-{g.Key.Month:00}",
                    netSales = g.Sum(m => m.NetSales),
                    goods = g.Sum(m => m.Goods),
                    labour = g.Sum(m => m.Labour),
                    expenses = g.Sum(m => m.Expenses),
                    profit = g.Sum(m => m.Profit),
                })
                .OrderByDescending(m => m.month),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                months = x.Value.Select(m => new { month = $"{m.Year:0000}-{m.Month:00}", m.NetSales, m.Profit }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_expenses", Title = "Expenses", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Operating expenses recorded in a period (rent, utilities, supplies, ...): the total, totals by category, and the largest expenses with vendor, note and who recorded them. Use for 'what did we spend on', 'electricity this month', 'biggest expenses'.")]
    public async Task<CallToolResult> GetExpenses(
        [Description(PeriodDescription)] string period = "this_month",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<ExpensesView>("finance-api", $"/api/finance/expenses?from={Day(p.FromDate)}&to={Day(p.ToDate)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var views = fan.Ok.Select(x => x.Value.Value).ToList();
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            total = views.Sum(v => v.Total),
            byCategory = views.SelectMany(v => v.ByCategory ?? [])
                .GroupBy(c => c.CategoryName?.Display ?? c.CategoryId.ToString(System.Globalization.CultureInfo.InvariantCulture))
                .Select(g => new { category = g.Key, total = g.Sum(c => c.Total) })
                .OrderByDescending(c => c.total),
            largest = fan.Ok.SelectMany(x => (x.Value.Value.Expenses ?? []).Select(e => new
            {
                branch = x.Branch.DisplayName,
                date = Day(e.Date),
                category = e.CategoryName?.Display,
                e.Amount,
                paidFrom = e.PaidFrom switch { 0 => "drawer", 1 => "bank", 2 => "partner", _ => e.PaidFrom.ToString(System.Globalization.CultureInfo.InvariantCulture) },
                e.PartnerName,
                e.Vendor,
                e.Note,
                e.RecordedBy,
            })).OrderByDescending(e => e.Amount).Take(top),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                total = x.Value.Value.Total,
                count = x.Value.Value.Expenses?.Count ?? 0,
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_supplier_balances", Title = "Supplier and partner balances", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("What the cafe currently owes each supplier (unpaid deliveries) and where each partner's account stands. Use for 'who do we owe', 'supplier balance', 'partner account'.")]
    public async Task<CallToolResult> GetSupplierBalances(
        [Description(BranchDescription)] string? branch = null,
        [Description("Include inactive suppliers and partners")] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        var suppliers = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<SupplierView>>("finance-api", $"/api/finance/suppliers?includeInactive={(includeInactive ? "true" : "false")}", b.Id, ct));
        var partners = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<PartnerView>>("finance-api", $"/api/finance/partners?includeInactive={(includeInactive ? "true" : "false")}", b.Id, ct));
        if (!suppliers.AnyOk && !partners.AnyOk) return ToolResults.Fail(string.Join("\n", suppliers.Errors.Concat(partners.Errors)));

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            owedToSuppliers = suppliers.Ok.SelectMany(x => x.Value).Sum(s => s.Balance),
            suppliers = suppliers.Ok.SelectMany(x => x.Value.Select(s => new { branch = x.Branch.DisplayName, s.Name, s.Balance, s.IsActive }))
                .OrderByDescending(s => s.Balance),
            partners = partners.Ok.SelectMany(x => x.Value.Select(p => new { branch = x.Branch.DisplayName, p.Name, p.Balance, p.IsActive }))
                .OrderByDescending(p => Math.Abs(p.Balance)),
            errors = ErrorsOrNull(suppliers.Errors.Concat(partners.Errors).ToList()),
        });
    }

    private async Task<(TenantSnapshot? Snapshot, IReadOnlyList<BranchResponse>? Branches, CallToolResult? Fail)> Resolve(string? branch, CancellationToken ct)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return (null, null, ToolResults.Fail(snapshot.Error!));
        var branches = BranchSelector.Select(snapshot.Value!.Branches, branch);
        if (!branches.IsOk) return (null, null, ToolResults.Fail(branches.Error!));
        return (snapshot.Value, branches.Value, null);
    }
}
