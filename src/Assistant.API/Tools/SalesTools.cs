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
    /// <summary>Told to the model beside every money figure, so it never calls gross sales "net".</summary>
    internal const string SalesDefinitions =
        "grossSales is what customers paid on the bills settled in the period (VAT, service and delivery fees in). " +
        "refunds is the credit notes issued in the period. netSales = grossSales - refunds: this is \"net sales\" (and \"revenue\" or \"sales\" when the person does not say gross). " +
        "netSalesExVat is netSales without the VAT inside it. Cash in tenders is net of the change handed back; cashTendered is what was handed over. " +
        "Tab payments are money collected against customers' tabs, not sales.";

    [McpServerTool(Name = "get_sales_summary", Title = "Sales summary", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Sales totals for a period: gross sales, refunds, net sales (gross less refunds - the figure to call 'net sales' or 'revenue'), net sales without VAT, settled tickets, the discounts (bill, line, loyalty and promo), VAT, service charge, delivery fees, totals per tender (cash net of change), tab payments by tender, and per ticket type and channel. Use for 'how much did we sell', 'revenue', 'net sales', 'cash versus card', 'how many tickets'. Omit branch for all branches with a line per branch.")]
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
            definitions = SalesDefinitions,
            total = new
            {
                ticketsSettled = reports.Sum(r => r.TicketsSettled),
                grossSales = reports.Sum(r => r.GrossSales),
                refunds = reports.Sum(r => r.Refunds),
                refundCount = reports.Sum(r => r.RefundCount),
                netSales = reports.Sum(r => r.NetSales),
                netSalesExVat = reports.Sum(r => r.NetSalesExVat),
                averageBill = Average(reports.Sum(r => r.GrossSales), reports.Sum(r => r.TicketsSettled)),
                subtotal = reports.Sum(r => r.Subtotal),
                discounts = new
                {
                    total = reports.Sum(r => r.Discounts),
                    bill = reports.Sum(r => r.BillDiscounts),
                    line = reports.Sum(r => r.LineDiscounts),
                    loyaltyAndPromo = reports.Sum(r => r.LoyaltyAndPromo),
                },
                serviceCharge = reports.Sum(r => r.ServiceCharge),
                vat = reports.Sum(r => r.Vat),
                vatAddedOnTop = reports.Sum(r => r.VatAdded),
                deliveryFees = reports.Sum(r => r.DeliveryFees),
                changeGiven = reports.Sum(r => r.ChangeGiven),
                cashTendered = reports.Sum(r => r.CashTendered),
                tenders = MergeTenders(reports.SelectMany(r => r.TenderTotals ?? [])),
                tabPayments = reports.Sum(r => r.TabPayments),
                tabPaymentCount = reports.Sum(r => r.TabPaymentCount),
                tabPaymentTenders = MergeTenders(reports.SelectMany(r => r.TabPaymentTenderTotals ?? [])),
                byType = reports.SelectMany(r => r.ByType ?? [])
                    .GroupBy(t => t.Type)
                    .Select(g => new { type = g.Key, count = g.Sum(t => t.Count), grossSales = g.Sum(t => t.Net) })
                    .OrderByDescending(t => t.grossSales),
                byChannel = reports.SelectMany(r => r.ByChannel ?? [])
                    .GroupBy(c => c.Channel)
                    .Select(g => new { channel = g.Key, count = g.Sum(c => c.Count), grossSales = g.Sum(c => c.Gross) })
                    .OrderByDescending(c => c.grossSales),
            },
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                period = x.Value.Period.Label,
                ticketsSettled = x.Value.Value.TicketsSettled,
                grossSales = x.Value.Value.GrossSales,
                refunds = x.Value.Value.Refunds,
                netSales = x.Value.Value.NetSales,
                netSalesExVat = x.Value.Value.NetSalesExVat,
                discounts = x.Value.Value.Discounts,
                changeGiven = x.Value.Value.ChangeGiven,
                tenders = MergeTenders(x.Value.Value.TenderTotals ?? []),
                tabPaymentTenders = MergeTenders(x.Value.Value.TabPaymentTenderTotals ?? []),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    private static decimal? Average(decimal amount, int count) => count == 0 ? null : Math.Round(amount / count, 2);

    private static IEnumerable<object> MergeTenders(IEnumerable<TenderTotal> tenders)
        => tenders
            .GroupBy(t => t.Tender)
            .Select(g => new { tender = g.Key, amount = g.Sum(t => t.Amount), count = g.Sum(t => t.Count), tendered = g.Sum(t => t.Tendered) })
            .OrderByDescending(t => t.amount)
            .ToList();

    [McpServerTool(Name = "get_sales_breakdown", Title = "Sales breakdown", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Where the sales came from in a period, by one dimension: hour of day, weekday, cashier, or menu item. Hours, weekdays and cashiers are gross sales (before refunds); cashiers also carry their net sales and refunds; items carry what customers paid for them (amount, the bill's discounts, VAT and service spread over the items; the delivery fee is not an item), the units, what was refunded and the net. Use for 'busiest hour', 'best-selling item', 'which day of the week is strongest', 'who sold the most'. Rows are merged across branches when branch is omitted.")]
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

        // In the business's zone, each bill at its own offset: a period across a
        // clock change keeps its hours
        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<BreakdownReport>("sales-api",
                $"/api/tickets/reports/breakdown?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}&tz={Uri.EscapeDataString(snap!.Zone.Id)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var reports = fan.Ok.Select(x => x.Value.Value).ToList();
        object rows = dim switch
        {
            "hour" => reports.SelectMany(r => r.ByHour ?? []).GroupBy(h => h.Hour)
                .Select(g => new { hour = g.Key, count = g.Sum(h => h.Count), grossSales = g.Sum(h => h.Net) })
                .OrderBy(h => h.hour).ToList(),
            "weekday" => reports.SelectMany(r => r.ByWeekday ?? []).GroupBy(w => w.Weekday)
                .Select(g => new { weekday = WeekdayName(g.Key), count = g.Sum(w => w.Count), grossSales = g.Sum(w => w.Net) })
                .OrderByDescending(w => w.grossSales).ToList(),
            "cashier" => reports.SelectMany(r => r.ByCashier ?? []).GroupBy(c => c.Name)
                .Select(g => new { cashier = g.Key, kind = CashierKind(g.First().Kind), count = g.Sum(c => c.Count), grossSales = g.Sum(c => c.Net), refunds = g.Sum(c => c.Refunds), netSales = g.Sum(c => c.NetSales), discounts = g.Sum(c => c.Discounts), voids = g.Sum(c => c.Voids) })
                .OrderByDescending(c => c.grossSales).Take(top).ToList(),
            // One row per catalog item across branches (the same item may be
            // named differently in each); by name only where there is no id
            _ => reports.SelectMany(r => r.ByItem ?? []).GroupBy(i => i.CatalogItemId is { } id ? $"#{id}" : i.Description?.Display ?? "")
                .Select(g => new
                {
                    item = g.Select(i => i.Description?.Display).FirstOrDefault(n => !string.IsNullOrEmpty(n)) ?? "",
                    itemAr = g.Select(i => i.Description?.Arabic).FirstOrDefault(a => a is not null),
                    catalogItemId = g.Select(i => i.CatalogItemId).FirstOrDefault(id => id is not null),
                    qty = g.Sum(i => i.Qty),
                    amount = g.Sum(i => i.Amount),
                    menuAmount = g.Sum(i => i.MenuAmount),
                    refundedQty = g.Sum(i => i.RefundedQty),
                    refundedAmount = g.Sum(i => i.RefundedAmount),
                    netQty = g.Sum(i => i.NetQty),
                    netAmount = g.Sum(i => i.NetAmount),
                    tickets = g.Sum(i => i.Tickets),
                })
                .OrderByDescending(i => i.amount).Take(top).ToList(),
        };

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            dimension = dim,
            timeZone = snap.Zone.Id,
            note = dim == "item"
                ? "amount is what customers paid for the item (its share of the bills, discounts, VAT and service included); netAmount takes off what was refunded in the period."
                : "grossSales is before refunds.",
            branches = fan.Ok.Select(x => new { id = x.Branch.Id, name = x.Branch.DisplayName, nameAr = x.Branch.NameAr }),
            rows,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    /// <summary>What a cashier row stands for, so the model never names the system a member of staff.</summary>
    private static string CashierKind(string? kind) => kind switch
    {
        "Platform" => "delivery platform (settled by itself, not a person)",
        "Online" => "paid online (settled by itself, not a person)",
        "Rider" => "delivery rider's cash (settled by itself, not a person)",
        "Automatic" => "automatic (voided or refunded because the order was cancelled, not a person)",
        _ => "staff",
    };

    [McpServerTool(Name = "get_daily_sales_trend", Title = "Daily sales trend", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Day by day for a period, by business day: gross sales, refunds, net sales (gross less refunds) and settled tickets each day, plus how many customer orders were placed and the top-selling items. Use for 'trend', 'compare days', 'which day was best this month'. The money is the till's settled sales; orders are a secondary count of customer orders (app, table, counter), not tickets.")]
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

        var zone = Uri.EscapeDataString(snap!.Zone.Id);
        string DayStart(BranchResponse b) => Uri.EscapeDataString(b.DayStart.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture));

        // Each branch's business days, in the business's zone from the branch's day start
        var fan = await PerBranchWithPeriodAsync(snap, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<DailyReport>("sales-api",
                $"/api/tickets/reports/daily?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}&tz={zone}&dayStart={DayStart(b)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        // The orders beside them, on the same business days; every item, so
        // branches add up item by item. A failure here leaves the money standing
        var orders = await PerBranchWithPeriodAsync(snap, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<OrderStats>("ordering-api",
                $"/api/orders/stats?fromDate={Utc(p.FromUtc)}&toDate={Utc(p.ToUtc)}&tz={zone}&dayStart={DayStart(b)}&top=0", b.Id, ct));

        var days = fan.Ok.SelectMany(x => x.Value.Value.Days ?? []).ToList();
        var orderDays = orders.Ok.SelectMany(x => x.Value.Value.Days ?? [])
            .GroupBy(d => d.Date ?? "")
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Orders));

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap.Currency,
            definitions = SalesDefinitions,
            days = days.GroupBy(d => d.Date ?? "")
                .Select(g => new
                {
                    date = g.Key,
                    ticketsSettled = g.Sum(d => d.Tickets),
                    grossSales = g.Sum(d => d.GrossSales),
                    refunds = g.Sum(d => d.Refunds),
                    netSales = g.Sum(d => d.NetSales),
                    orders = orders.AnyOk ? orderDays.GetValueOrDefault(g.Key) : (int?)null,
                })
                .OrderBy(d => d.date),
            topItems = orders.Ok.SelectMany(s => s.Value.Value.TopItems ?? [])
                .GroupBy(i => i.ProductId != 0 ? $"#{i.ProductId}" : i.ProductName?.Display ?? "")
                .Select(g => new { item = g.Select(i => i.ProductName?.Display).FirstOrDefault(n => !string.IsNullOrEmpty(n)) ?? "", itemAr = g.Select(i => i.ProductName?.Arabic).FirstOrDefault(a => a is not null), units = g.Sum(i => i.Units), revenue = g.Sum(i => i.Revenue) })
                .OrderByDescending(i => i.revenue).Take(top),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                ticketsSettled = (x.Value.Value.Days ?? []).Sum(d => d.Tickets),
                grossSales = (x.Value.Value.Days ?? []).Sum(d => d.GrossSales),
                refunds = (x.Value.Value.Days ?? []).Sum(d => d.Refunds),
                netSales = (x.Value.Value.Days ?? []).Sum(d => d.NetSales),
            }),
            errors = ErrorsOrNull(fan.Errors.Concat(orders.Errors).ToList()),
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
                branchAr = x.Branch.NameAr,
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
                ? new { branch = x.Branch.DisplayName, branchAr = x.Branch.NameAr, open = false, openedBy = (string?)null, openedAt = (string?)null, ticketsSettled = 0, salesTotal = 0m }
                : new { branch = x.Branch.DisplayName, branchAr = x.Branch.NameAr, open = true, openedBy = x.Value.OpenedBy, openedAt = (string?)Local(x.Value.OpenedAt), ticketsSettled = x.Value.TicketsSettled, salesTotal = x.Value.SalesTotal }),
            closedShifts = closed.Ok.SelectMany(x => (x.Value.Value).Select(s => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                s.Id,
                s.OpenedBy,
                openedAt = Local(s.OpenedAt),
                s.ClosedBy,
                closedAt = s.ClosedAt is { } c ? Local(c) : null,
                s.TicketsSettled,
                grossSales = s.SalesTotal,
                s.RefundsTotal,
                netSales = s.NetSales,
                s.ExpectedCash,
                counted = s.ClosingCount,
                s.OverShort,
                // Cash from sales rung up offline during the shift that came in after it closed:
                // in the drawer when it was counted, so the real over/short is the adjusted one
                lateCash = s.LateCash != 0 ? s.LateCash : (decimal?)null,
                adjustedOverShort = s.LateCash != 0 ? s.AdjustedOverShort : null,
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
