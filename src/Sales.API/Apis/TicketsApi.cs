using System.Security.Claims;
#nullable enable
using Chillax.Sales.API.Application.Commands;
using Chillax.Sales.API.Application.Queries;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Sales.API.Apis;

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
            .WithDescription("The caller picks the window — pass the branch's business-day bounds for the day report.");

        api.MapGet("/reports/breakdown", GetBreakdownReport)
            .WithName("GetBreakdownReport")
            .WithSummary("Settled sales in a window by hour, weekday, cashier and item")
            .WithDescription("offsetMinutes is how far the caller's clock is ahead of UTC; hours and weekdays come back in it.");

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
        int offsetMinutes = 0)
    {
        if (to <= from)
        {
            return TypedResults.BadRequest("The report window must end after it starts.");
        }

        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetBreakdownAsync(branchId, from, to, offsetMinutes));
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
                request.Type, branchId, request.TableId, request.TableName, request.Label));

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
                request.ProvisionalReceiptNumber));

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
            await mediator.SendIdentified<VoidTicketCommand, bool>(requestId, new VoidTicketCommand(id, request.Reason, httpContext.GetActor()));
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
                    : new NewTicketTarget(request.NewTicket.Type, request.NewTicket.TableId, request.NewTicket.TableName, request.NewTicket.Label)));
            return TypedResults.Ok(new OpenTicketResponse(targetTicketId));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

/// <param name="Label">What to call a counter tab — a name for humans, not a customer.</param>
public record OpenTicketRequest(TicketType Type, int? TableId = null, LocalizedText? TableName = null, string? Label = null);

public record OpenTicketResponse(int TicketId);

public record AddLineRequest(LocalizedText Description, decimal Qty, decimal UnitPrice, decimal Discount = 0, string? CustomerName = null);

/// <param name="SettledAt">When the money was actually taken, for a till replaying a sale it rang up while offline; null settles now.</param>
/// <param name="ProvisionalReceiptNumber">The number the till printed on the offline receipt, kept beside the real one.</param>
public record SettleRequest(List<SettlePayment> Payments, DateTime? SettledAt = null, string? ProvisionalReceiptNumber = null);

public record SettlePayment(PaymentTender Tender, decimal Amount, string? CustomerId = null, string? CustomerName = null);

public record MoveLinesRequest(List<int> LineIds, int? TargetTicketId = null, NewTicketRequest? NewTicket = null);

public record AssignLinesCustomerRequest(List<int> LineIds, string? CustomerId, string CustomerName);

/// <summary>A ticket to open for moved lines: a counter tab (with an optional name), or a table's bill.</summary>
public record NewTicketRequest(TicketType Type, int? TableId = null, LocalizedText? TableName = null, string? Label = null);

public record VoidTicketRequest(string Reason);

/// <summary>One of Rate (a fraction: 0.1 is 10%) or Amount (money off the bill).</summary>
public record DiscountRequest(string? Reason = null, decimal? Rate = null, decimal? Amount = null);

public record RefundRequest(List<RefundLineRequest> Lines, string Reason, PaymentTender Tender, string? CustomerId = null, string? CustomerName = null);

public record RefundLineRequest(int LineId, decimal Qty);

/// <summary>Money taken against a customer's tab; the amount is what the customer handed over.</summary>
public record TabPaymentRequest(string CustomerId, string? CustomerName, PaymentTender Tender, decimal Amount);

/// <summary>Rates are fractions: 0.14 is 14%. MaxCashierDiscountRate is how much of a bill a cashier may take off alone.</summary>
public record PricingRequest(decimal VatRate, bool PricesIncludeVat, decimal ServiceChargeRate, decimal MaxCashierDiscountRate = BranchPricing.DefaultMaxCashierDiscountRate);
