using System.ComponentModel;
using System.Security.Claims;
#nullable enable
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.API.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Sales.API.Apis;

public static class TicketsApi
{
    public static RouteGroupBuilder MapTicketsApi(this IEndpointRouteBuilder app)
    {
        // "Pos" = Admin, Owner or Cashier — the till runs without back-office access
        var api = app.NewVersionedApi("Tickets")
            .MapGroup("api/tickets")
            .HasApiVersion(1.0)
            .RequireAuthorization("Pos");

        // The customer's side of a bill: anyone signed in may ask for a
        // receipt, and gets it only if they were on that bill
        var receipts = app.NewVersionedApi("Receipts")
            .MapGroup("api/tickets")
            .HasApiVersion(1.0)
            .RequireAuthorization();

        // The customer's bills: everything on them today, open or paid, as
        // the till adds it up. A guest is known by the id their browser
        // sends, the way Ordering knows their orders.
        receipts.MapGet("/mine", GetMyBills)
            .AllowAnonymous()
            .WithName("GetMyBills")
            .WithSummary("The caller's bills: open ones, and those settled since a given time")
            .WithDescription("Every ticket the caller is on — sat in the room, ordered a line, or paid a share — with its lines and the till's totals. Open bills always; settled and voided ones since `since` (default: the last 24 hours). Signed in, or a guest by X-Guest-Id.");

        receipts.MapGet("/{id:int}/receipt", GetReceipt)
            .WithName("GetTicketReceipt")
            .WithSummary("A settled bill's receipt, for a customer who was on it")
            .WithDescription("The customer's own copy of the printed receipt. Allowed for whoever sat in the room, ordered a line, or paid a share; 404 until the bill is settled.");

        api.MapGet("/open", GetOpenTickets)
            .WithName("GetOpenTickets")
            .WithSummary("Open tickets for the branch (the POS floor)");

        api.MapGet("/settled", GetSettledTickets)
            .WithName("GetSettledTickets")
            .WithSummary("Settled bills for the branch, newest receipt first")
            .WithDescription("The receipts screen: the way back to a bill after it closed, to reprint it or refund it. Pass receiptNumber to find one.");

        api.MapGet("/history", GetTicketHistory)
            .WithName("GetTicketHistory")
            .WithSummary("Closed tickets — settled or voided — newest first, with the count (the back office)")
            .WithDescription("The window is on the moment the ticket closed: settledAt for Settled, voidedAt for Voided. Pass receiptNumber to find one bill regardless of the window. Read-only; the till's own list is /settled.");

        api.MapGet("/payments", GetPayments)
            .WithName("GetPayments")
            .WithSummary("Payments taken on tickets settled in a window, newest first")
            .WithDescription("Windowed on the ticket's settle, not the payment, so the page adds up to the range report's tender split for the same window. Pass tender to see one kind.");

        api.MapGet("/refunds", GetRefunds)
            .WithName("GetRefunds")
            .WithSummary("Credit notes issued in a window, newest first")
            .WithDescription("Every refund across the branch's tickets; open the ticket for the lines behind one.");

        api.MapGet("/tab-payments", GetTabPayments)
            .WithName("GetTabPayments")
            .WithSummary("Tab payment slips taken in a window, newest first")
            .WithDescription("Money customers handed the till against their tabs. Not sales: the bills were counted when they went on account.");

        api.MapGet("/tab-payments/{id:int}", GetTabPayment)
            .WithName("GetTabPayment")
            .WithSummary("One tab payment slip, to reprint it");

        api.MapPost("/tab-payments", RecordTabPayment)
            .WithName("RecordTabPayment")
            .WithSummary("Take money against a customer's tab")
            .WithDescription("Cash into the drawer, card or InstaPay to the terminal — never Account. A numbered slip, stamped with the branch's open shift so the drawer count and the Z report include it; Accounts lowers the balance owed off the event. Slips are never voided: a mistake is reversed by a manual charge on the ledger (and a cash pay-out if cash was handed back).");

        api.MapGet("/{id:int}", GetTicket)
            .WithName("GetTicket")
            .WithSummary("Ticket detail with lines, payments and receipt number");

        api.MapGet("/reports/range", GetRangeReport)
            .WithName("GetRangeReport")
            .WithSummary("Settled sales over a window: tender split, discounts, per-type counts")
            .WithDescription("The caller picks the window — pass the branch's business-day bounds for the day report. netSales is gross sales less the refunds issued in the window; net (gross) is kept for older screens. Cash in tenderTotals is net of change; tendered and cashTendered keep what was handed over.");

        api.MapGet("/reports/breakdown", GetBreakdownReport)
            .WithName("GetBreakdownReport")
            .WithSummary("Settled sales in a window by hour, weekday, cashier and item")
            .WithDescription("tz is the IANA zone the hours and weekdays are read in (each bill at its own moment's offset, so daylight saving is right); offsetMinutes, how far a fixed clock is ahead of UTC, is still read when tz is not given; neither means the business's own zone. Items are valued at what customers paid (Amount) and at menu money (MenuAmount), with the refunds issued in the window netted per item; the delivery fee is not an item.");

        api.MapGet("/reports/daily", GetDailyReport)
            .WithName("GetDailyReport")
            .WithSummary("Settled sales per business day: gross, refunds, net and tickets")
            .WithDescription("A business day starts at dayStart (HH:mm, the branch's day start; 00:00 when not given) in the IANA zone tz (the business's own when not given) and runs to the same time the next day. Every day the window [from, to) touches is listed, empty ones included. Net is gross less the credit notes issued that day, the same net sales as the range report's.");

        api.MapGet("/reports/pairs", GetItemPairsReport)
            .WithName("GetItemPairsReport")
            .WithSummary("What an item was bought with, on settled tickets in a window")
            .WithDescription("Of the settled tickets that had the item, how many also had each other catalog item, most often first (up to 15). The pairing suggester weighs these over its own guesses.");

        api.MapGet("/by-order/{orderId:int}", GetTicketByOrder)
            .WithName("GetTicketByOrder")
            .WithSummary("The ticket a confirmed order landed on")
            .WithDescription("404 while the order's confirmation event is still in flight — the POS polls this after creating a counter sale.");

        api.MapPost("/", OpenTicket)
            .WithName("OpenTicket")
            .WithSummary("Open a counter or table ticket by hand")
            .WithDescription("Room tickets are never opened this way — they follow their session events.");

        api.MapPost("/{id:int}/lines", AddManualLine)
            .WithName("AddTicketLine")
            .WithSummary("Add a manual line to an open ticket");

        api.MapPost("/{id:int}/settle", SettleTicket)
            .WithName("SettleTicket")
            .WithSummary("Settle an open ticket")
            .WithDescription("Payments must cover the total; on cash, the excess is returned as change. Issues the receipt number.");

        api.MapPost("/{id:int}/move-lines", MoveLines)
            .WithName("MoveTicketLines")
            .WithSummary("Move lines to another ticket")
            .WithDescription("No target: the table-turnover split, a fresh ticket for the same place. A target ticket: onto that open bill — the customer who ordered at a table and then took a room. A new ticket: a fresh counter tab, or a table's bill (opened if the table has none) — the customer who moved tables or went to pay at the counter. Session time never moves; a table or counter ticket left empty is discarded. Returns the ticket the lines ended up on.");

        api.MapPost("/{id:int}/lines/customer", AssignLinesCustomer)
            .WithName("AssignTicketLinesCustomer")
            .WithSummary("Name the customer on chosen lines")
            .WithDescription("The split-bill fix: several people rang up as one sale, and some lines were theirs. Sets the customer snapshot on just those lines — bill grouping, receipt, Account tender. Points do not move: they follow the whole order (assign the order's customer in Ordering for that). Session time cannot be reassigned.");

        api.MapPost("/{id:int}/discount", ApplyDiscount)
            .WithName("ApplyTicketDiscount")
            .WithSummary("Take a percent or an amount off the whole bill, with a reason")
            .WithDescription("Exactly one of rate (a fraction, 0.1 is 10%) or amount; the reason is optional. A cashier is capped by the branch's MaxCashierDiscountRate; an owner is not. Given again, it replaces the earlier discount.");

        api.MapDelete("/{id:int}/discount", RemoveDiscount)
            .WithName("RemoveTicketDiscount")
            .WithSummary("Take the discount back off an open ticket");

        api.MapPost("/{id:int}/void", VoidTicket)
            .WithName("VoidTicket")
            .WithSummary("Void an open ticket with nothing owed (owner only)")
            .WithDescription("A mistake, a comp, a walked group. The reason is the audit trail. Settled tickets cannot be voided.")
            .RequireAuthorization("Owner");

        api.MapPost("/{id:int}/refunds", RefundTicket)
            .WithName("RefundTicket")
            .WithSummary("Refund lines of a settled ticket as a numbered credit note (owner only)")
            .WithDescription("Full or partial, by line and quantity. Each line gives back what the customer paid for it, service charge and VAT included. Cash comes out of the drawer; Account credits the named tab. Loyalty points the refunded orders earned are clawed back in proportion. The settled ticket itself never changes.")
            .RequireAuthorization("Owner");

        api.MapGet("/pricing/{branchId:int}", GetPricing)
            .WithName("GetBranchPricing")
            .WithSummary("How a branch's menu prices become the bill: VAT, whether it sits inside the price, service charge");

        api.MapPut("/pricing/{branchId:int}", SetPricing)
            .WithName("SetBranchPricing")
            .WithSummary("Set a branch's VAT and service charge (owner only)")
            .WithDescription("Rates are fractions: 0.14 is 14%. Service applies to what is ordered at tables and rooms, never to counter sales or room time. Applies to tickets settled from now on; printed receipts keep their figures.")
            .RequireAuthorization("Owner");

        api.MapDelete("/{id:int}", DiscardTicket)
            .WithName("DiscardTicket")
            .WithSummary("Discard an empty open ticket")
            .WithDescription("Opened by mistake and never used. Counter and table tickets with no lines only — nothing happened on them, so there is nothing to audit and the row is deleted. A ticket with lines is voided (owner) instead.");

        return api;
    }

    public static async Task<Ok<IEnumerable<TicketSummary>>> GetOpenTickets(
        HttpContext httpContext,
        [FromServices] ITicketQueries queries)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetOpenTicketsAsync(branchId));
    }

    public static async Task<Ok<IEnumerable<SettledTicketSummary>>> GetSettledTickets(
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        int pageIndex = 0,
        int pageSize = 30,
        int? receiptNumber = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetSettledTicketsAsync(branchId, pageIndex, Math.Clamp(pageSize, 1, 100), receiptNumber));
    }

    public static async Task<Results<Ok<PagedResult<TicketHistoryRow>>, BadRequest<string>>> GetTicketHistory(
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        TicketStatus status = TicketStatus.Settled,
        DateTime? from = null,
        DateTime? to = null,
        int? receiptNumber = null,
        int pageIndex = 0,
        int pageSize = 20)
    {
        if (status == TicketStatus.Open)
        {
            return TypedResults.BadRequest("History lists closed tickets; open ones are on /open.");
        }

        if (from is not null && to is not null && to <= from)
        {
            return TypedResults.BadRequest("The window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetTicketHistoryAsync(
            branchId, status, from, to, receiptNumber, Math.Max(0, pageIndex), Math.Clamp(pageSize, 1, 100)));
    }

    public static async Task<Results<Ok<PagedResult<PaymentRow>>, BadRequest<string>>> GetPayments(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        PaymentTender? tender = null,
        int pageIndex = 0,
        int pageSize = 20)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetPaymentsAsync(
            branchId, from, to, tender, Math.Max(0, pageIndex), Math.Clamp(pageSize, 1, 100)));
    }

    public static async Task<Results<Ok<PagedResult<RefundSummary>>, BadRequest<string>>> GetRefunds(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetRefundsAsync(
            branchId, from, to, Math.Max(0, pageIndex), Math.Clamp(pageSize, 1, 100)));
    }

    public static async Task<Results<Ok<PagedResult<TabPaymentView>>, BadRequest<string>>> GetTabPayments(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetTabPaymentsAsync(
            branchId, from, to, Math.Max(0, pageIndex), Math.Clamp(pageSize, 1, 100)));
    }

    public static async Task<Results<Ok<TabPaymentView>, NotFound>> GetTabPayment(
        int id,
        [FromServices] ITicketQueries queries)
    {
        var slip = await queries.GetTabPaymentAsync(id);
        return slip is null ? TypedResults.NotFound() : TypedResults.Ok(slip);
    }

    public static async Task<Results<Ok<TabPaymentResult>, BadRequest<string>>> RecordTabPayment(
        TabPaymentRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var result = await mediator.SendIdentified<RecordTabPaymentCommand, TabPaymentResult>(requestId, new RecordTabPaymentCommand(
                branchId,
                request.CustomerId,
                request.CustomerName,
                request.Tender,
                request.Amount,
                httpContext.GetActor()));

            return TypedResults.Ok(result);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<IEnumerable<BillView>>, UnauthorizedHttpResult>> GetMyBills(
        ClaimsPrincipal user,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        [Description("Only bills settled or voided after this moment (UTC); open bills come regardless")] DateTime? since = null)
    {
        var userId = user.GetUserId();
        var guestId = userId is null ? httpContext.GetGuestId() : null;
        if (userId is null && guestId is null)
        {
            return TypedResults.Unauthorized();
        }
        var bills = await queries.GetMyBillsAsync(userId, guestId, since ?? DateTime.UtcNow.AddHours(-24));
        return TypedResults.Ok(bills);
    }

    public static async Task<Results<Ok<ReceiptView>, NotFound, ForbidHttpResult>> GetReceipt(
        int id,
        ClaimsPrincipal user,
        [FromServices] ITicketRepository tickets,
        [FromServices] ITicketQueries queries)
    {
        var userId = user.GetUserId();
        var ticket = await tickets.GetAsync(id);
        if (ticket is null || ticket.SettledAt is null)
        {
            return TypedResults.NotFound();
        }
        if (userId is null || !ticket.Involves(userId))
        {
            return TypedResults.Forbid();
        }
        var detail = await queries.GetTicketAsync(id);
        if (detail?.ReceiptNumber is null || detail.SettledAt is null)
        {
            return TypedResults.NotFound();
        }
        return TypedResults.Ok(new ReceiptView(
            detail.Id,
            detail.ReceiptNumber.Value,
            detail.BranchId,
            detail.Type,
            detail.LocationName,
            detail.SettledAt.Value,
            detail.Lines.Select(l => new ReceiptLineView(l.Description, l.Details, l.Qty, l.UnitPrice, l.Discount, l.Total, l.CustomerName)).ToList(),
            detail.Subtotal,
            detail.Discount,
            detail.DiscountRate,
            detail.ServiceCharge,
            detail.ServiceChargeRate,
            detail.Vat,
            detail.VatRate,
            detail.VatIncluded,
            detail.Total,
            detail.ChangeGiven,
            detail.Payments.Select(p => new ReceiptPaymentView(p.Tender, p.Amount, p.CustomerName)).ToList(),
            detail.Refunds.Select(r => new ReceiptRefundView(r.Number, r.Amount, r.Reason, r.Tender, r.RefundedAt)).ToList(),
            detail.RefundedTotal));
    }

    public static async Task<Results<Ok<TicketDetail>, NotFound>> GetTicket(
        int id,
        [FromServices] ITicketQueries queries)
    {
        var ticket = await queries.GetTicketAsync(id);
        return ticket is null ? TypedResults.NotFound() : TypedResults.Ok(ticket);
    }

    public static async Task<Results<Ok<RangeReport>, BadRequest<string>>> GetRangeReport(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The report window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetRangeReportAsync(branchId, from, to));
    }

    public static async Task<Results<Ok<BreakdownReport>, BadRequest<string>>> GetBreakdownReport(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        int? offsetMinutes = null,
        string? tz = null)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The report window must end after it starts.");
        }

        // The zone asked for; a caller that still sends a fixed offset keeps
        // it; one that says neither reads the business's own zone
        TimeZoneInfo? zone = null;
        if (tz is not null)
        {
            zone = ReportClock.FindZone(tz);
            if (zone is null)
                return TypedResults.BadRequest($"Unknown time zone '{tz}'. Use an IANA id such as Africa/Cairo.");
        }
        else if (offsetMinutes is null)
        {
            zone = TenantClock.Zone;
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetBreakdownAsync(branchId, from, to, offsetMinutes ?? 0, zone));
    }

    public static async Task<Results<Ok<DailyReport>, BadRequest<string>>> GetDailyReport(
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries,
        string? tz = null,
        string? dayStart = null)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The report window must end after it starts.");
        }

        // A year of days is as much as one answer holds
        if (to - from > TimeSpan.FromDays(367))
        {
            return TypedResults.BadRequest("The daily report covers at most a year.");
        }

        var zone = tz is null ? TenantClock.Zone : ReportClock.FindZone(tz);
        if (zone is null)
        {
            return TypedResults.BadRequest($"Unknown time zone '{tz}'. Use an IANA id such as Africa/Cairo.");
        }

        var start = TimeOnly.MinValue;
        if (dayStart is not null
            && !TimeOnly.TryParseExact(dayStart, ["HH:mm", "HH:mm:ss", "H:mm"], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out start))
        {
            return TypedResults.BadRequest($"dayStart must be a time of day as HH:mm, not '{dayStart}'.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetDailyReportAsync(branchId, from, to, zone, start));
    }

    public static async Task<Results<Ok<ItemPairsReport>, BadRequest<string>>> GetItemPairsReport(
        int itemId,
        DateTime from,
        DateTime to,
        HttpContext httpContext,
        [FromServices] ITicketQueries queries)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The report window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetItemPairsAsync(branchId, itemId, from, to));
    }

    public static async Task<Results<Ok<OpenTicketResponse>, NotFound>> GetTicketByOrder(
        int orderId,
        [FromServices] ITicketQueries queries)
    {
        var ticketId = await queries.FindTicketIdByOrderAsync(orderId);
        return ticketId is null ? TypedResults.NotFound() : TypedResults.Ok(new OpenTicketResponse(ticketId.Value));
    }

    public static async Task<Results<Ok<OpenTicketResponse>, BadRequest<string>>> OpenTicket(
        OpenTicketRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var ticketId = await mediator.SendIdentified<OpenTicketCommand, int>(requestId, new OpenTicketCommand(
                request.Type, branchId, request.Label, request.PlaceId, request.PlaceName));

            return TypedResults.Ok(new OpenTicketResponse(ticketId));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> AddManualLine(
        int id,
        AddLineRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.SendIdentified<AddManualLineCommand, bool>(requestId, new AddManualLineCommand(
                id,
                request.Description,
                request.Qty,
                request.UnitPrice,
                request.Discount,
                httpContext.GetActor(),
                request.CustomerName));

            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<SettleResult>, BadRequest<string>>> SettleTicket(
        int id,
        SettleRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var result = await mediator.SendIdentified<SettleTicketCommand, SettleResult>(requestId, new SettleTicketCommand(
                id,
                request.Payments.Select(p => new PaymentDto(p.Tender, p.Amount, p.CustomerId, p.CustomerName)).ToList(),
                httpContext.GetActor(),
                request.SettledAt,
                request.ProvisionalReceiptNumber,
                request.ShiftId));

            return TypedResults.Ok(result);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> ApplyDiscount(
        int id,
        DiscountRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.SendIdentified<ApplyTicketDiscountCommand, bool>(requestId, new ApplyTicketDiscountCommand(
                id,
                request.Rate,
                request.Amount,
                request.Reason,
                httpContext.GetActor(),
                Uncapped: httpContext.User.IsInRole("Owner")));

            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, BadRequest<string>>> RemoveDiscount(
        int id,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new RemoveTicketDiscountCommand(id));
            return TypedResults.NoContent();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> VoidTicket(
        int id,
        VoidTicketRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            if (request.StockDisposition is { } disposition && !StockDispositions.IsKnown(disposition))
            {
                return TypedResults.BadRequest("Stock disposition is Waste or Restock.");
            }

            await mediator.SendIdentified<VoidTicketCommand, bool>(
                requestId, new VoidTicketCommand(id, request.Reason, httpContext.GetActor(), request.StockDisposition));
            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<RefundResult>, BadRequest<string>>> RefundTicket(
        int id,
        RefundRequest request,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var result = await mediator.SendIdentified<RefundTicketCommand, RefundResult>(requestId, new RefundTicketCommand(
                id,
                request.Lines.Select(l => new RefundLineDto(l.LineId, l.Qty)).ToList(),
                request.Reason,
                request.Tender,
                request.CustomerId,
                request.CustomerName,
                httpContext.GetActor()));

            return TypedResults.Ok(result);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<PricingView>> GetPricing(
        int branchId,
        [FromServices] ITicketQueries queries)
        => TypedResults.Ok(await queries.GetPricingAsync(branchId));

    public static async Task<Results<Ok, BadRequest<string>>> SetPricing(
        int branchId,
        PricingRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new SetBranchPricingCommand(
                branchId,
                request.VatRate,
                request.PricesIncludeVat,
                request.ServiceChargeRate,
                request.MaxCashierDiscountRate,
                httpContext.GetActor()));

            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, BadRequest<string>>> DiscardTicket(
        int id,
        HttpContext httpContext,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.SendIdentified<DiscardTicketCommand, bool>(requestId, new DiscardTicketCommand(id, httpContext.GetActor()));
            return TypedResults.NoContent();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, BadRequest<string>>> AssignLinesCustomer(
        int id,
        AssignLinesCustomerRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.SendIdentified<AssignTicketLinesCustomerCommand, bool>(requestId, new AssignTicketLinesCustomerCommand(id, request.LineIds, request.CustomerId, request.CustomerName));
            return TypedResults.NoContent();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<OpenTicketResponse>, BadRequest<string>>> MoveLines(
        int id,
        MoveLinesRequest request,
        [FromHeader(Name = "x-requestid")] Guid? requestId,
        [FromServices] IMediator mediator)
    {
        try
        {
            var targetTicketId = await mediator.SendIdentified<MoveTicketLinesCommand, int>(requestId, new MoveTicketLinesCommand(
                id,
                request.LineIds,
                request.TargetTicketId,
                request.NewTicket is null
                    ? null
                    : new NewTicketTarget(request.NewTicket.Type, request.NewTicket.Label, request.NewTicket.PlaceId, request.NewTicket.PlaceName)));
            return TypedResults.Ok(new OpenTicketResponse(targetTicketId));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

/// <param name="Label">What to call a counter tab — a name for humans, not a customer.</param>
/// <param name="PlaceId">The Spaces place of a table bill.</param>
public record OpenTicketRequest(TicketType Type, string? Label = null, int? PlaceId = null, LocalizedText? PlaceName = null);

public record OpenTicketResponse(int TicketId);

public record AddLineRequest(LocalizedText Description, decimal Qty, decimal UnitPrice, decimal Discount = 0, string? CustomerName = null);

/// <param name="SettledAt">When the money was actually taken, for a till replaying a sale it rang up while offline; null settles now.</param>
/// <param name="ProvisionalReceiptNumber">The number the till printed on the offline receipt, kept beside the real one.</param>
/// <param name="ShiftId">
/// The drawer shift the sale was rung up in, for a till replaying an offline sale. Taken when it is this
/// branch's and was open at <paramref name="SettledAt"/>, even if it has closed since (its Z report then
/// shows the sale's cash as late cash); otherwise ignored, and the branch's open shift takes the sale.
/// </param>
public record SettleRequest(List<SettlePayment> Payments, DateTime? SettledAt = null, string? ProvisionalReceiptNumber = null, int? ShiftId = null);

public record SettlePayment(PaymentTender Tender, decimal Amount, string? CustomerId = null, string? CustomerName = null);

public record MoveLinesRequest(List<int> LineIds, int? TargetTicketId = null, NewTicketRequest? NewTicket = null);

public record AssignLinesCustomerRequest(List<int> LineIds, string? CustomerId, string CustomerName);

/// <summary>A ticket to open for moved lines: a counter tab (with an optional name), or a table's bill.</summary>
public record NewTicketRequest(TicketType Type, string? Label = null, int? PlaceId = null, LocalizedText? PlaceName = null);

/// <param name="StockDisposition">
/// What becomes of the food on the bill: "Waste" (it was made) or "Restock"
/// (it never was), as the cashier said. Left out, Ordering decides from what
/// the kitchen did.
/// </param>
public record VoidTicketRequest(string Reason, string? StockDisposition = null);

/// <summary>One of Rate (a fraction: 0.1 is 10%) or Amount (money off the bill).</summary>
public record DiscountRequest(string? Reason = null, decimal? Rate = null, decimal? Amount = null);

public record RefundRequest(List<RefundLineRequest> Lines, string Reason, PaymentTender Tender, string? CustomerId = null, string? CustomerName = null);

public record RefundLineRequest(int LineId, decimal Qty);

/// <summary>Money taken against a customer's tab; the amount is what the customer handed over.</summary>
public record TabPaymentRequest(string CustomerId, string? CustomerName, PaymentTender Tender, decimal Amount);

/// <summary>Rates are fractions: 0.14 is 14%. MaxCashierDiscountRate is how much of a bill a cashier may take off alone.</summary>
public record PricingRequest(decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate = BranchPricing.DefaultMaxCashierDiscountRate);
