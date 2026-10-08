using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The floor and the back office as they stand: orders, open bills, the
/// rooms and tables, deliveries and riders, payslips, and how each branch is
/// set up. Each reads a branch at a time; a module the plan leaves out
/// answers in a sentence that says so.
/// </summary>
[McpServerToolType]
public sealed class OperationsReadTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    /// <summary>The words the owner may use for an order's state, and Ordering's own name for it.</summary>
    private static readonly Dictionary<string, string> OrderStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["new"] = "Submitted", ["pending"] = "Submitted", ["submitted"] = "Submitted", ["waiting"] = "Submitted",
        ["confirmed"] = "Confirmed", ["accepted"] = "Confirmed",
        ["cancelled"] = "Cancelled", ["canceled"] = "Cancelled", ["rejected"] = "Cancelled",
        ["awaiting_payment"] = "AwaitingPayment", ["unpaid"] = "AwaitingPayment", ["awaitingpayment"] = "AwaitingPayment",
        ["awaiting_validation"] = "AwaitingValidation", ["awaitingvalidation"] = "AwaitingValidation",
    };

    [McpServerTool(Name = "get_orders", Title = "Orders", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Customer orders (app, table, counter, delivery, Talabat) in a period, newest first: number, time, status, total, who ordered, where (table or room), how it was paid, promo code, delivery stage and rider, refunds, rating. Filter by status or search by order number or customer name. Use for 'how many orders were cancelled today', 'find order 1042', 'orders from Ahmed', 'pending orders right now'. For money totals prefer get_sales_summary.")]
    public async Task<CallToolResult> GetOrders(
        [Description("pending (new, not yet accepted), confirmed, cancelled or unpaid; several separated by commas. Omit for every status.")] string? status = null,
        [Description("An order number, or part of the customer's name")] string? search = null,
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        string? statuses = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var parts = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(s => s.Replace(' ', '_')).ToList();
            var unknown = parts.FirstOrDefault(s => !OrderStatuses.ContainsKey(s));
            if (unknown is not null) return ToolResults.Fail($"Unknown status '{unknown}'. Use pending, confirmed, cancelled or unpaid.");
            statuses = string.Join(",", parts.Select(s => OrderStatuses[s]).Distinct());
        }

        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var filters = (statuses is not null ? $"&status={statuses}" : "") + (!string.IsNullOrWhiteSpace(search) ? $"&search={Uri.EscapeDataString(search.Trim())}" : "");
        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<PagedResult<OrderSummaryView>>("ordering-api",
                $"/api/orders/all?pageIndex=0&pageSize={top}&fromDate={Utc(p.FromUtc)}&toDate={Utc(p.ToUtc)}{filters}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var rows = fan.Ok.SelectMany(x => (x.Value.Value.Items ?? []).Select(o => (x.Branch, o))).ToList();
        var total = fan.Ok.Sum(x => x.Value.Value.TotalCount);
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            orders = total,
            listedByStatus = rows.GroupBy(r => r.o.Status).Select(g => new { status = g.Key, count = g.Count(), total = g.Sum(r => r.o.Total) }),
            rows = rows.OrderByDescending(r => r.o.Date).Take(top).Select(r => new
            {
                branch = r.Branch.DisplayName,
                branchAr = r.Branch.NameAr,
                number = r.o.OrderNumber,
                at = ReadSupport.Local(snap, r.o.Date),
                r.o.Status,
                total = Math.Round(r.o.Total, 2),
                r.o.Source,
                customer = r.o.UserName,
                place = r.o.PlaceName?.Display,
                placeAr = r.o.PlaceName?.Arabic,
                paidWith = r.o.PaysOnline ? "Online" : r.o.PaidWith,
                receipt = r.o.ReceiptNumber,
                promo = r.o.PromoCode,
                promoDiscount = r.o.PromoDiscount != 0 ? r.o.PromoDiscount : (decimal?)null,
                refunded = r.o.RefundedAmount != 0 ? r.o.RefundedAmount : (decimal?)null,
                voided = r.o.VoidedAt is not null ? true : (bool?)null,
                delivery = r.o.Delivery is { } d ? new { d.Stage, rider = d.RiderName, d.Fee } : null,
                rating = r.o.RatingValue,
            }),
            note = total > rows.Count ? $"Only the newest {Math.Min(top, rows.Count)} of {total} are listed; raise top or narrow the search for more." : null,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_open_tickets", Title = "Open bills", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The bills open right now at each branch, oldest first: where (counter, table, room), when opened, how long since anything was added, how many lines and the running total, plus the count and value open per branch. Use for 'how many tables are open', 'what is still unpaid on the floor', 'which bill has been open longest'.")]
    public async Task<CallToolResult> GetOpenTickets(
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);
        var now = clock.GetUtcNow().UtcDateTime;

        var fan = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<OpenTicketView>>("sales-api", "/api/tickets/open", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            open = fan.Ok.Sum(x => x.Value.Count),
            openValue = fan.Ok.Sum(x => x.Value.Sum(t => t.Total)),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                open = x.Value.Count,
                value = x.Value.Sum(t => t.Total),
                bills = x.Value.OrderBy(t => t.OpenedAt).Take(top).Select(t => new
                {
                    t.Id,
                    t.Type,
                    where = t.LocationName?.Display ?? t.Label,
                    whereAr = t.LocationName?.Arabic,
                    label = t.LocationName is not null ? t.Label : null,
                    openedAt = ReadSupport.Local(snap, t.OpenedAt),
                    idleMinutes = (int)Math.Max(0, (now - DateTime.SpecifyKind(t.LastActivityAt, DateTimeKind.Utc)).TotalMinutes),
                    lines = t.LineCount,
                    t.Total,
                }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_reservations", Title = "Reservations", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Table and room reservations: the open ones now (requested or confirmed, soonest first, with whether the place is being held), and the closed ones in a period (seated, completed, cancelled, expired) with counts by outcome. Each with the place, customer, party size and time. Use for 'any bookings tonight', 'how many no-shows this week', 'who booked room 2'.")]
    public async Task<CallToolResult> GetReservations(
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var open = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<ReservationView>>("spaces-api", "/api/reservations/open", b.Id, ct));
        var closed = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<PagedResult<ReservationView>>("spaces-api",
                $"/api/reservations/history?pageIndex=0&pageSize={top}&fromDate={Utc(p.FromUtc)}&toDate={Utc(p.ToUtc)}", b.Id, ct));
        if (!open.AnyOk && !closed.AnyOk) return ToolResults.Fail(string.Join("\n", open.Errors.Concat(closed.Errors).Distinct()));

        object Row(BranchResponse b, ReservationView r) => new
        {
            branch = b.DisplayName,
            branchAr = b.NameAr,
            r.Id,
            place = r.PlaceName?.Display,
            placeAr = r.PlaceName?.Arabic,
            r.PlaceKind,
            customer = r.CustomerName,
            party = r.PartySize,
            @for = ReadSupport.Local(snap!, r.For ?? r.CreatedAt),
            r.Status,
            holdingNow = r.IsHolding ? true : (bool?)null,
            r.Notes,
        };

        var openRows = open.Ok.SelectMany(x => x.Value.Select(r => (x.Branch, r))).OrderBy(x => x.r.For ?? x.r.CreatedAt).ToList();
        var closedRows = closed.Ok.SelectMany(x => (x.Value.Value.Items ?? []).Select(r => (x.Branch, r))).OrderByDescending(x => x.r.For ?? x.r.CreatedAt).ToList();
        var closedTotal = closed.Ok.Sum(x => x.Value.Value.TotalCount);
        return ToolResults.Ok(new
        {
            openNow = openRows.Count,
            open = openRows.Take(top).Select(x => Row(x.Branch, x.r)),
            period = closed.Ok.Count > 0 ? closed.Ok[0].Value.Period.Label : null,
            closedInPeriod = closedTotal,
            closedByOutcome = closedRows.GroupBy(x => x.r.Status).Select(g => new { status = g.Key, count = g.Count() }),
            closed = closedRows.Take(top).Select(x => Row(x.Branch, x.r)),
            note = closedTotal > closedRows.Count ? $"The outcomes count the {closedRows.Count} listed of {closedTotal}; raise top for all." : null,
            errors = ReadSupport.Errors(open.Errors, closed.Errors),
        });
    }

    [McpServerTool(Name = "get_place_usage", Title = "Rooms and stations usage", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("How the timed places (rooms, gaming stations) were used in a period: stays, hours and time revenue in total, per place (busiest first) and per day, plus the stays running right now with who is in, since when and the rate. Use for 'which room makes the most', 'hours played this week', 'who is in room 3 now'.")]
    public async Task<CallToolResult> GetPlaceUsage(
        [Description(PeriodDescription)] string period = "last_7_days",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);
        var now = clock.GetUtcNow();
        var offset = ReadSupport.JsOffsetMinutes(snap!, now);

        var stats = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, now,
            (b, p) => api.GetAsync<StayStatsView>("spaces-api", $"/api/stays/stats?fromDate={Utc(p.FromUtc)}&toDate={Utc(p.ToUtc)}&tzOffsetMinutes={offset}", b.Id, ct));
        var running = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<StayView>>("spaces-api", "/api/stays/open", b.Id, ct));
        if (!stats.AnyOk && !running.AnyOk) return ToolResults.Fail(string.Join("\n", stats.Errors.Concat(running.Errors).Distinct()));

        var places = stats.Ok.SelectMany(x => (x.Value.Value.Places ?? []).Select(p => (x.Branch, p))).ToList();
        return ToolResults.Ok(new
        {
            period = stats.Ok.Count > 0 ? stats.Ok[0].Value.Period.Label : null,
            currency = snap!.Currency,
            stays = places.Sum(x => x.p.Stays),
            hours = Math.Round(places.Sum(x => x.p.Hours), 1),
            revenue = places.Sum(x => x.p.Revenue),
            byPlace = places.OrderByDescending(x => x.p.Revenue).ThenByDescending(x => x.p.Hours).Take(top).Select(x => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                place = x.p.PlaceName?.Display,
                placeAr = x.p.PlaceName?.Arabic,
                kind = x.p.PlaceKind,
                x.p.Stays,
                hours = Math.Round(x.p.Hours, 1),
                x.p.Revenue,
            }),
            byDay = stats.Ok.SelectMany(x => x.Value.Value.Days ?? []).GroupBy(d => d.Date)
                .Select(g => new { date = g.Key, stays = g.Sum(d => d.Stays), hours = Math.Round(g.Sum(d => d.Hours), 1), revenue = g.Sum(d => d.Revenue) })
                .OrderBy(d => d.date),
            runningNow = running.Ok.SelectMany(x => x.Value.Select(s => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                place = s.PlaceName?.Display,
                placeAr = s.PlaceName?.Arabic,
                customer = s.CustomerName,
                since = ReadSupport.Local(snap, s.StartedAt),
                minutes = (int)Math.Max(0, (now.UtcDateTime - DateTime.SpecifyKind(s.StartedAt, DateTimeKind.Utc)).TotalMinutes),
                rate = s.CurrentOptionName?.Display,
                rateAr = s.CurrentOptionName?.Arabic,
            })),
            errors = ReadSupport.Errors(stats.Errors, running.Errors),
        });
    }

    [McpServerTool(Name = "get_deliveries", Title = "Deliveries and riders", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The business's own deliveries now: each rider (online, quiet or off, deliveries out, delivered and failed today, cash handed in today), and the deliveries on the board (waiting, with a rider, on the way, delivered or failed in the last day) with customer, total, what to collect, rider and any cash short. Use for 'which riders are working', 'how many deliveries are out', 'did any rider come back short'.")]
    public async Task<CallToolResult> GetDeliveries(
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);
        var now = clock.GetUtcNow();
        var offset = ReadSupport.JsOffsetMinutes(snap!, now);

        var riders = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<RiderOverviewView>>("ordering-api", $"/api/orders/riders/overview?tzOffsetMinutes={offset}", b.Id, ct));
        var board = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<List<DeliveryOrderView>>("ordering-api", "/api/orders/deliveries", b.Id, ct));
        if (!riders.AnyOk && !board.AnyOk) return ToolResults.Fail(string.Join("\n", riders.Errors.Concat(board.Errors).Distinct()));

        var deliveries = board.Ok.SelectMany(x => x.Value.Select(d => (x.Branch, d))).ToList();
        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            ridersOnline = riders.Ok.Sum(x => x.Value.Count(r => r.Status == "Online")),
            deliveriesByStage = deliveries.GroupBy(x => x.d.Delivery?.Stage ?? "Unknown").Select(g => new { stage = g.Key, count = g.Count() }),
            riders = riders.Ok.SelectMany(x => x.Value.Select(r => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                r.Name,
                r.Status,
                disabled = r.Enabled ? (bool?)null : true,
                lastSeen = ReadSupport.Local(snap, r.LastSeenAt),
                r.Out,
                r.DeliveredToday,
                r.FailedToday,
                r.CashCollectedToday,
            })),
            deliveries = deliveries.OrderByDescending(x => x.d.Date).Take(top).Select(x => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                number = x.d.OrderNumber,
                at = ReadSupport.Local(snap, x.d.Date),
                customer = x.d.CustomerName,
                x.d.Total,
                x.d.ToCollect,
                paidOnline = x.d.PaidOnline ? true : (bool?)null,
                stage = x.d.Delivery?.Stage,
                rider = x.d.Delivery?.RiderName,
                address = x.d.Delivery?.Address,
                failure = x.d.Delivery?.FailureReason,
                cashDifference = x.d.CashDifference is { } c && c != 0 ? c : (decimal?)null,
            }),
            errors = ReadSupport.Errors(riders.Errors, board.Errors),
        });
    }

    [McpServerTool(Name = "get_payslips", Title = "Payslips", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Payslips whose pay period overlaps the period: per employee the days worked, earned, overtime, absence deductions, bonuses, deductions, advances, what is due, what is still to pay, and whether it is paid. Totals first. Use for 'what is the payroll this month', 'is Ahmed's salary paid', 'how much do we still owe in wages'.")]
    public async Task<CallToolResult> GetPayslips(
        [Description(PeriodDescription)] string period = "this_month",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;

        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<List<PayslipView>>("payroll-api", $"/api/payroll/payslips?from={Day(p.FromDate)}&to={Day(p.ToDate)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var slips = fan.Ok.SelectMany(x => x.Value.Value.Select(s => (x.Branch, s))).ToList();
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            payslips = slips.Count,
            amountDue = slips.Sum(x => x.s.AmountDue),
            stillToPay = slips.Where(x => x.s.Status != PayslipStatus.Paid).Sum(x => x.s.Remaining),
            paid = slips.Count(x => x.s.Status == PayslipStatus.Paid),
            rows = slips.OrderBy(x => x.s.Status).ThenBy(x => x.s.EmployeeName).Select(x => new
            {
                branch = x.Branch.DisplayName,
                branchAr = x.Branch.NameAr,
                employee = x.s.EmployeeName,
                from = Day(x.s.PeriodStart),
                to = Day(x.s.PeriodEnd),
                scheme = x.s.Scheme,
                x.s.Rate,
                x.s.DaysWorked,
                x.s.Earned,
                overtimePay = x.s.OvertimePay != 0 ? x.s.OvertimePay : (decimal?)null,
                absenceDeduction = x.s.AbsenceDeduction != 0 ? x.s.AbsenceDeduction : (decimal?)null,
                bonuses = x.s.Bonuses != 0 ? x.s.Bonuses : (decimal?)null,
                deductions = x.s.Deductions != 0 ? x.s.Deductions : (decimal?)null,
                advances = x.s.Advances != 0 ? x.s.Advances : (decimal?)null,
                x.s.AmountDue,
                x.s.Remaining,
                x.s.Status,
                paidAt = ReadSupport.Local(snap, x.s.PaidAt),
                x.s.PaidBy,
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_branch_settings", Title = "Branch settings", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("How each branch is set up: address, phone, tax number, business-day hours, whether online ordering, reservations and delivery are on, whether table orders or deliveries need a signed-in customer, and the delivery radius, fee and minimum order. Use for 'is delivery on at Maadi', 'what is our delivery fee', 'what time does the day start'.")]
    public async Task<CallToolResult> GetBranchSettings(
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (_, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;

        var all = await api.GetAsync<List<BranchSettingsView>>("tenant-api", "/api/branches/all", null, ct);
        if (!all.IsOk) return ToolResults.Fail(all.Error!);
        var asked = branches!.Select(b => b.Id).ToHashSet();

        return ToolResults.Ok(new
        {
            branches = all.Value!.Where(b => asked.Contains(b.Id)).OrderBy(b => b.DisplayOrder).ThenBy(b => b.Id).Select(b => new
            {
                b.Id,
                name = b.Name?.Display,
                nameAr = b.Name?.Arabic,
                address = b.Address?.Display is { Length: > 0 } a ? a : null,
                addressAr = b.Address?.Arabic,
                b.Phone,
                b.TaxNumber,
                b.IsActive,
                businessDayStartsAt = b.DayStartTime,
                businessDayEndsAt = b.DayEndTime,
                onlineOrdering = b.IsOrderingEnabled ? "on" : "paused",
                reservations = b.IsReservationsEnabled ? "on" : "off",
                tableOrdersNeedSignIn = b.RequireSignInForTableOrders,
                delivery = b.IsDeliveryEnabled
                    ? new { on = true, radiusKm = b.DeliveryRadiusKm, fee = (decimal?)b.DeliveryFee, minimumOrder = (decimal?)b.DeliveryMinimumOrder, needsSignIn = (bool?)b.RequireSignInForDelivery }
                    : new { on = false, radiusKm = (decimal?)null, fee = (decimal?)null, minimumOrder = (decimal?)null, needsSignIn = (bool?)null },
                locationPinned = b.Latitude is not null && b.Longitude is not null,
            }),
        });
    }

    [McpServerTool(Name = "get_pricing_rules", Title = "Pricing rules", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("How each branch turns menu prices into the bill: VAT rate and whether menu prices include it, the service charge (tables and rooms only), the most a cashier may discount, and the menu items priced differently at the branch than the chain's price. Use for 'do we charge service', 'what VAT do we add', 'which items cost more at Maadi'.")]
    public async Task<CallToolResult> GetPricingRules(
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;

        var pricing = await FanOut.PerBranchAsync(branches!, b => api.GetAsync<PricingView>("sales-api", $"/api/tickets/pricing/{b.Id}", b.Id, ct));
        if (!pricing.AnyOk) return ToolResults.Fail(string.Join("\n", pricing.Errors));

        // Branch prices are overrides on the chain's menu; the menu at the branch names them and gives the chain's price
        var overrides = await FanOut.PerBranchAsync(branches!, async b =>
        {
            var o = await api.GetAsync<List<BranchOverrideView>>("catalog-api", $"/api/catalog/branches/{b.Id}/overrides", b.Id, ct);
            if (!o.IsOk) return ApiResult<List<object>>.Fail(o.Error!, o.Status);
            var priced = o.Value!.Where(x => x.PriceOverride is not null || x.OfferPriceOverride is not null).ToList();
            if (priced.Count == 0) return ApiResult<List<object>>.Ok([]);
            var menu = await api.GetAsync<List<MenuItemView>>("catalog-api", "/api/catalog/items", b.Id, ct);
            if (!menu.IsOk) return ApiResult<List<object>>.Fail(menu.Error!, menu.Status);
            var items = menu.Value!.ToDictionary(i => i.Id);
            return ApiResult<List<object>>.Ok(priced.Where(x => items.ContainsKey(x.CatalogItemId)).Select(x => (object)new
            {
                item = items[x.CatalogItemId].Name?.Display,
                itemAr = items[x.CatalogItemId].Name?.Arabic,
                chainPrice = items[x.CatalogItemId].Base?.Price,
                price = x.PriceOverride,
                offerPrice = x.OfferPriceOverride,
            }).ToList());
        });

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            branches = pricing.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                vat = ReadSupport.Percent(x.Value.VatRate),
                pricesIncludeVat = x.Value.PricesIncludeVat,
                serviceCharge = ReadSupport.Percent(x.Value.ServiceChargeRate),
                maxCashierDiscount = ReadSupport.Percent(x.Value.MaxCashierDiscountRate),
                branchPrices = overrides.Ok.FirstOrDefault(o => o.Branch.Id == x.Branch.Id).Value,
            }),
            errors = ReadSupport.Errors(pricing.Errors, overrides.Errors),
        });
    }
}
