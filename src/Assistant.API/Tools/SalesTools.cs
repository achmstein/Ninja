using System.ComponentModel;
using System.Net;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

[McpServerToolType]
public sealed class SalesTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    [McpServerTool(Name = "get_sales_summary", Title = "Sales summary", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Sales totals for a period: net and gross sales, settled tickets, discounts, refunds, VAT, service charge, totals per tender (cash, card, ...) and per ticket type. Use for 'how much did we sell', 'revenue', 'cash versus card', 'how many tickets'. Omit branch for all branches with a line per branch.")]
    public async Task<CallToolResult> GetSalesSummary(
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<RangeReport>("sales-api", $"/api/tickets/reports/range?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var reports = fan.Ok.Select(x => x.Value.Value).ToList();
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            total = new
            {
                ticketsSettled = reports.Sum(r => r.TicketsSettled),
                net = reports.Sum(r => r.Net),
                subtotal = reports.Sum(r => r.Subtotal),
                discounts = reports.Sum(r => r.Discounts),
                serviceCharge = reports.Sum(r => r.ServiceCharge),
                vat = reports.Sum(r => r.Vat),
                refunds = reports.Sum(r => r.Refunds),
                refundCount = reports.Sum(r => r.RefundCount),
                tabPayments = reports.Sum(r => r.TabPayments),
                tenders = reports.SelectMany(r => r.TenderTotals ?? [])
                    .GroupBy(t => t.Tender)
                    .Select(g => new { tender = g.Key, amount = g.Sum(t => t.Amount), count = g.Sum(t => t.Count) })
                    .OrderByDescending(t => t.amount),
                byType = reports.SelectMany(r => r.ByType ?? [])
                    .GroupBy(t => t.Type)
                    .Select(g => new { type = g.Key, count = g.Sum(t => t.Count), net = g.Sum(t => t.Net) })
                    .OrderByDescending(t => t.net),
            },
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                period = x.Value.Period.Label,
                ticketsSettled = x.Value.Value.TicketsSettled,
                net = x.Value.Value.Net,
                discounts = x.Value.Value.Discounts,
                refunds = x.Value.Value.Refunds,
                tenders = (x.Value.Value.TenderTotals ?? []).Select(t => new { t.Tender, t.Amount, t.Count }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_sales_breakdown", Title = "Sales breakdown", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Where the sales came from in a period, by one dimension: hour of day, weekday, cashier, or menu item. Use for 'busiest hour', 'best-selling item', 'which day of the week is strongest', 'who sold the most'. Rows are merged across branches when branch is omitted.")]
    public async Task<CallToolResult> GetSalesBreakdown(
        [Description("hour, weekday, cashier or item")] string dimension = "item",
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var dim = dimension.Trim().ToLowerInvariant();
        if (dim is not ("hour" or "weekday" or "cashier" or "item"))
            return ToolResults.Fail("dimension must be hour, weekday, cashier or item.");

        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<BreakdownReport>("sales-api",
                $"/api/tickets/reports/breakdown?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}&offsetMinutes={p.OffsetMinutes}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var reports = fan.Ok.Select(x => x.Value.Value).ToList();
        object rows = dim switch
        {
            "hour" => reports.SelectMany(r => r.ByHour ?? []).GroupBy(h => h.Hour)
                .Select(g => new { hour = g.Key, count = g.Sum(h => h.Count), net = g.Sum(h => h.Net) })
                .OrderBy(h => h.hour).ToList(),
            "weekday" => reports.SelectMany(r => r.ByWeekday ?? []).GroupBy(w => w.Weekday)
                .Select(g => new { weekday = WeekdayName(g.Key), count = g.Sum(w => w.Count), net = g.Sum(w => w.Net) })
                .OrderByDescending(w => w.net).ToList(),
            "cashier" => reports.SelectMany(r => r.ByCashier ?? []).GroupBy(c => c.Name)
                .Select(g => new { cashier = g.Key, count = g.Sum(c => c.Count), net = g.Sum(c => c.Net), discounts = g.Sum(c => c.Discounts), voids = g.Sum(c => c.Voids), refunds = g.Sum(c => c.Refunds) })
                .OrderByDescending(c => c.net).Take(top).ToList(),
            _ => reports.SelectMany(r => r.ByItem ?? []).GroupBy(i => i.Description?.Display ?? "")
                .Select(g => new { item = g.Key, itemAr = g.Select(i => i.Description?.Ar).FirstOrDefault(a => a is not null), qty = g.Sum(i => i.Qty), amount = g.Sum(i => i.Amount), tickets = g.Sum(i => i.Tickets), catalogItemId = g.Select(i => i.CatalogItemId).FirstOrDefault(id => id is not null) })
                .OrderByDescending(i => i.amount).Take(top).ToList(),
        };

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            dimension = dim,
            branches = fan.Ok.Select(x => new { id = x.Branch.Id, name = x.Branch.DisplayName }),
            rows,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_daily_sales_trend", Title = "Daily sales trend", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Day by day for a period: how many customer orders and how much revenue each day, plus the top-selling items. Use for 'trend', 'compare days', 'which day was best this month'. Counts customer orders (app, table, counter), not drawer tickets; for money totals prefer get_sales_summary.")]
    public async Task<CallToolResult> GetDailySalesTrend(
        [Description(PeriodDescription)] string period = "last_7_days",
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
            (b, p) => api.GetAsync<OrderStats>("ordering-api",
                $"/api/orders/stats?fromDate={Utc(p.FromUtc)}&toDate={Utc(p.ToUtc)}&tzOffsetMinutes={p.OffsetMinutes}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var stats = fan.Ok.Select(x => x.Value.Value).ToList();
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            days = stats.SelectMany(s => s.Days ?? []).GroupBy(d => d.Date)
                .Select(g => new { date = g.Key, orders = g.Sum(d => d.Orders), revenue = g.Sum(d => d.Revenue) })
                .OrderBy(d => d.date),
            topItems = stats.SelectMany(s => s.TopItems ?? []).GroupBy(i => i.ProductName?.Display ?? "")
                .Select(g => new { item = g.Key, units = g.Sum(i => i.Units), revenue = g.Sum(i => i.Revenue) })
                .OrderByDescending(i => i.revenue).Take(top),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                orders = (x.Value.Value.Days ?? []).Sum(d => d.Orders),
                revenue = (x.Value.Value.Days ?? []).Sum(d => d.Revenue),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_refunds", Title = "Refunds", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Refunds given in a period: receipt number, amount, tender, reason, who refunded and when. Use for 'any refunds', 'why did we refund', 'refunds by cashier'.")]
    public async Task<CallToolResult> GetRefunds(
        [Description(PeriodDescription)] string period = "today",
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
            (b, p) => api.GetAsync<PagedResult<RefundSummary>>("sales-api",
                $"/api/tickets/refunds?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}&pageIndex=0&pageSize={top}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            refundCount = fan.Ok.Sum(x => x.Value.Value.TotalCount),
            refunds = fan.Ok.SelectMany(x => (x.Value.Value.Items ?? []).Select(r => new
            {
                branch = x.Branch.DisplayName,
                r.ReceiptNumber,
                r.Amount,
                r.Tender,
                r.Reason,
                r.CustomerName,
                r.RefundedBy,
                refundedAt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(r.RefundedAt, DateTimeKind.Utc), snap.Zone).ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture),
            })).OrderByDescending(r => r.refundedAt).Take(top),
            note = fan.Ok.Any(x => x.Value.Value.TotalCount > (x.Value.Value.Items?.Count ?? 0)) ? "Only the newest refunds are listed; raise top for more." : null,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_shifts", Title = "Drawer shifts", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Drawer shifts: which shift is open right now (who opened it and when), and the closed shifts in a period with sales, expected cash versus the counted cash and the over/short. Use for 'is the till open', 'who closed last night', 'was the drawer short'.")]
    public async Task<CallToolResult> GetShifts(
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var current = await FanOut.PerBranchAsync(branches!, async b =>
        {
            var r = await api.GetAsync<ShiftView>("sales-api", "/api/shifts/current", b.Id, ct);
            if (!r.IsOk && r.Status == HttpStatusCode.NotFound) return ApiResult<ShiftView?>.Ok(null);
            return r.IsOk ? ApiResult<ShiftView?>.Ok(r.Value) : ApiResult<ShiftView?>.Fail(r.Error!, r.Status);
        });
        var closed = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<List<ShiftView>>("sales-api",
                $"/api/shifts?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}&pageIndex=0&pageSize={Math.Min(top, 50)}", b.Id, ct));
        if (!current.AnyOk && !closed.AnyOk) return ToolResults.Fail(string.Join("\n", current.Errors.Concat(closed.Errors)));

        string Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), snap!.Zone).ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture);

        return ToolResults.Ok(new
        {
            period = closed.Ok.Count > 0 ? closed.Ok[0].Value.Period.Label : null,
            currency = snap!.Currency,
            openNow = current.Ok.Select(x => x.Value is null
                ? new { branch = x.Branch.DisplayName, open = false, openedBy = (string?)null, openedAt = (string?)null, ticketsSettled = 0, salesTotal = 0m }
                : new { branch = x.Branch.DisplayName, open = true, openedBy = x.Value.OpenedBy, openedAt = (string?)Local(x.Value.OpenedAt), ticketsSettled = x.Value.TicketsSettled, salesTotal = x.Value.SalesTotal }),
            closedShifts = closed.Ok.SelectMany(x => (x.Value.Value).Select(s => new
            {
                branch = x.Branch.DisplayName,
                s.Id,
                s.OpenedBy,
                openedAt = Local(s.OpenedAt),
                s.ClosedBy,
                closedAt = s.ClosedAt is { } c ? Local(c) : null,
                s.TicketsSettled,
                s.SalesTotal,
                s.RefundsTotal,
                s.ExpectedCash,
                counted = s.ClosingCount,
                s.OverShort,
            })).OrderByDescending(s => s.openedAt).Take(top),
            errors = ErrorsOrNull(current.Errors.Concat(closed.Errors).ToList()),
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
