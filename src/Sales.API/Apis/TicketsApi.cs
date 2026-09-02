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

        api.MapGet("/open", GetOpenTickets)
            .WithName("GetOpenTickets")
            .WithSummary("Open tickets for the branch (the POS floor)");

        api.MapGet("/{id:int}", GetTicket)
            .WithName("GetTicket")
            .WithSummary("Ticket detail with lines, payments and receipt number");

        api.MapGet("/reports/range", GetRangeReport)
            .WithName("GetRangeReport")
            .WithSummary("Settled sales over a window: tender split, discounts, per-type counts")
            .WithDescription("The caller picks the window — pass the branch's business-day bounds for the day report.");

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
            .WithSummary("Move lines to a fresh ticket for the same place")
            .WithDescription("The table-turnover guard: an order that landed on the previous group's bill gets its own ticket.");

        api.MapPost("/{id:int}/void", VoidTicket)
            .WithName("VoidTicket")
            .WithSummary("Void an open ticket with nothing owed (owner only)")
            .WithDescription("A mistake, a comp, a walked group. The reason is the audit trail. Settled tickets cannot be voided.")
            .RequireAuthorization("Owner");

        return api;
    }

    public static async Task<Ok<IEnumerable<TicketSummary>>> GetOpenTickets(
        HttpContext httpContext,
        [FromServices] ITicketQueries queries)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetOpenTicketsAsync(branchId));
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
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var ticketId = await mediator.Send(new OpenTicketCommand(
                request.Type, branchId, request.TableId, request.TableName, request.CustomerName));

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
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new AddManualLineCommand(
                id,
                request.Description,
                request.Qty,
                request.UnitPrice,
                request.Discount,
                httpContext.User.GetUserId() ?? "unknown"));

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
        [FromServices] IMediator mediator)
    {
        try
        {
            var result = await mediator.Send(new SettleTicketCommand(
                id,
                request.Payments.Select(p => new PaymentDto(p.Tender, p.Amount)).ToList(),
                httpContext.User.GetUserId() ?? "unknown"));

            return TypedResults.Ok(result);
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
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new VoidTicketCommand(id, request.Reason, httpContext.User.GetUserId() ?? "unknown"));
            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<OpenTicketResponse>, BadRequest<string>>> MoveLines(
        int id,
        MoveLinesRequest request,
        [FromServices] IMediator mediator)
    {
        try
        {
            var newTicketId = await mediator.Send(new MoveTicketLinesCommand(id, request.LineIds));
            return TypedResults.Ok(new OpenTicketResponse(newTicketId));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

public record OpenTicketRequest(TicketType Type, int? TableId = null, LocalizedText? TableName = null, string? CustomerName = null);

public record OpenTicketResponse(int TicketId);

public record AddLineRequest(LocalizedText Description, decimal Qty, decimal UnitPrice, decimal Discount = 0);

public record SettleRequest(List<SettlePayment> Payments);

public record SettlePayment(PaymentTender Tender, decimal Amount);

public record MoveLinesRequest(List<int> LineIds);

public record VoidTicketRequest(string Reason);
