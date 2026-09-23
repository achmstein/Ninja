#nullable enable
using Ninja.Ordering.Domain.Seedwork;
using Microsoft.AspNetCore.Http.HttpResults;

/// <summary>
/// The kitchen's stations and its printers' queue. Stations split an order
/// by who makes it and say how each part is heard of — a screen, a printer,
/// or both. The shop's printers are out of the server's reach, so a device in
/// the shop (a till, a kitchen tablet) takes tickets from the queue, prints
/// them and reports back.
/// </summary>
public static class KitchenApi
{
    public static RouteGroupBuilder MapKitchenApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/kitchen").HasApiVersion(1.0);

        // Kitchen screens pick their station from here, so the till's roles read it
        api.MapGet("/stations", GetStationsAsync)
            .WithName("GetKitchenStations")
            .WithSummary("The branch's kitchen stations (staff)")
            .WithDescription("In display order. A branch that has none gets its default station, which makes everything on one screen.")
            .RequireAuthorization("Pos");

        api.MapPost("/stations", CreateStationAsync)
            .WithName("CreateKitchenStation")
            .WithSummary("Add a kitchen station (admin)")
            .WithDescription("Refused when another station already makes one of its categories, when it neither shows nor prints, or when it prints without a printer address.")
            .RequireAuthorization("Admin");

        api.MapPut("/stations/{stationId:int}", UpdateStationAsync)
            .WithName("UpdateKitchenStation")
            .WithSummary("Change a kitchen station (admin)")
            .WithDescription("Orders already in the kitchen keep the station as it was when they arrived.")
            .RequireAuthorization("Admin");

        api.MapDelete("/stations/{stationId:int}", DeleteStationAsync)
            .WithName("DeleteKitchenStation")
            .WithSummary("Remove a kitchen station (admin)")
            .WithDescription("The default station cannot be removed, nor one with orders still on its screen. Its categories go to the default station from the next order.")
            .RequireAuthorization("Admin");

        api.MapPost("/stations/{stationId:int}/test-print", TestPrintAsync)
            .WithName("TestPrintKitchenStation")
            .WithSummary("Queue a test page for a station's printer (admin)")
            .RequireAuthorization("Admin");

        api.MapGet("/print-jobs", GetPrintJobsAsync)
            .WithName("GetKitchenPrintJobs")
            .WithSummary("Tickets waiting for a kitchen printer (staff)")
            .WithDescription("The branch's unprinted tickets from the last day, oldest first, each with its printer's address and the lines to print. A ticket with a live claim is being printed by another device.")
            .RequireAuthorization("Pos");

        api.MapPost("/print-jobs/{jobId:int}/claim", ClaimPrintJobAsync)
            .WithName("ClaimKitchenPrintJob")
            .WithSummary("Take a ticket to print (print host)")
            .WithDescription("204 when this device has it; 409 when it is printed or another device holds it. A claim lapses after a minute.")
            .RequireAuthorization("Pos");

        api.MapPost("/print-jobs/{jobId:int}/printed", MarkPrintedAsync)
            .WithName("MarkKitchenPrintJobPrinted")
            .WithSummary("Report a ticket printed (print host)")
            .RequireAuthorization("Pos");

        api.MapPost("/print-jobs/{jobId:int}/failed", MarkFailedAsync)
            .WithName("MarkKitchenPrintJobFailed")
            .WithSummary("Report the printer refused a ticket (print host)")
            .WithDescription("Lets the claim go so any device can try again; the error is kept for the till's warning.")
            .RequireAuthorization("Pos");

        return api;
    }

    /// <summary>The order-side kitchen moves, on the orders group next to the whole-order ready.</summary>
    public static RouteGroupBuilder MapKitchenOrderRoutes(this RouteGroupBuilder orders)
    {
        orders.MapPut("/{orderId:int}/stations/{stationId:int}/ready", SetStationReadyAsync)
            .WithName("SetOrderStationReady")
            .WithSummary("Mark a station's part of an order ready, or bring it back (staff)")
            .WithDescription("The order is ready once every part on a screen is. A part that only prints is never marked. Repeating the current state is a no-op.")
            .RequireAuthorization("Pos");

        orders.MapPost("/{orderId:int}/reprint", ReprintOrderAsync)
            .WithName("ReprintOrderKitchenTickets")
            .WithSummary("Print an order's kitchen tickets again (staff)")
            .WithDescription("Every station that printed its part gets its ticket again, marked REPRINT. Refused for an order nothing of which went to a printer.")
            .RequireAuthorization("Pos");

        orders.MapPost("/{orderId:int}/stations/{stationId:int}/reprint", ReprintAsync)
            .WithName("ReprintKitchenTicket")
            .WithSummary("Print a station's ticket for an order again (staff)")
            .RequireAuthorization("Pos");

        return orders;
    }

    public static async Task<Ok<List<KitchenStationView>>> GetStationsAsync(
        HttpContext httpContext,
        IKitchenStationRepository stations)
    {
        var list = await stations.GetForBranchAsync(httpContext.GetRequiredBranchId());
        // The default a branch gets on first sight is kept, so its id holds
        await stations.UnitOfWork.SaveChangesAsync();
        return TypedResults.Ok(list.Select(KitchenStationView.From).ToList());
    }

    public static async Task<Results<Ok<KitchenStationView>, BadRequest<string>, NotFound>> CreateStationAsync(
        HttpContext httpContext,
        KitchenStationRequest request,
        IMediator mediator,
        IKitchenStationRepository stations)
        => await SaveStationAsync(httpContext.GetRequiredBranchId(), null, request, mediator, stations);

    public static async Task<Results<Ok<KitchenStationView>, BadRequest<string>, NotFound>> UpdateStationAsync(
        int stationId,
        HttpContext httpContext,
        KitchenStationRequest request,
        IMediator mediator,
        IKitchenStationRepository stations)
        => await SaveStationAsync(httpContext.GetRequiredBranchId(), stationId, request, mediator, stations);

    private static async Task<Results<Ok<KitchenStationView>, BadRequest<string>, NotFound>> SaveStationAsync(
        int branchId, int? stationId, KitchenStationRequest request, IMediator mediator, IKitchenStationRepository stations)
    {
        try
        {
            var id = await mediator.Send(new SaveKitchenStationCommand(
                branchId, stationId, request.Name, request.CategoryIds ?? [], request.ShowsOnScreen, request.PrintsTickets,
                request.PrinterHost, request.PrinterPort, request.DisplayOrder));

            if (id is null)
            {
                return TypedResults.NotFound();
            }

            var station = await stations.GetAsync(id.Value);
            return TypedResults.Ok(KitchenStationView.From(station!));
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, BadRequest<string>, NotFound>> DeleteStationAsync(
        int stationId,
        HttpContext httpContext,
        IMediator mediator)
    {
        try
        {
            return await mediator.Send(new DeleteKitchenStationCommand(httpContext.GetRequiredBranchId(), stationId))
                ? TypedResults.NoContent()
                : TypedResults.NotFound();
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> TestPrintAsync(
        int stationId,
        HttpContext httpContext,
        IMediator mediator)
        => QueueAsync(new QueueKitchenTicketCommand(httpContext.GetRequiredBranchId(), stationId, null), mediator);

    public static Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> ReprintAsync(
        int orderId,
        int stationId,
        HttpContext httpContext,
        IMediator mediator)
        => QueueAsync(new QueueKitchenTicketCommand(httpContext.GetRequiredBranchId(), stationId, orderId), mediator);

    public static Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> ReprintOrderAsync(
        int orderId,
        HttpContext httpContext,
        IMediator mediator)
        => QueueAsync(new ReprintOrderTicketsCommand(httpContext.GetRequiredBranchId(), orderId), mediator);

    private static async Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> QueueAsync(
        IRequest<PrintJobOutcome> command, IMediator mediator)
    {
        try
        {
            return ToResult(await mediator.Send(command));
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<List<KitchenTicket>>> GetPrintJobsAsync(
        HttpContext httpContext,
        IKitchenQueries queries)
        => TypedResults.Ok(await queries.GetPendingTicketsAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> ClaimPrintJobAsync(
        int jobId,
        HttpContext httpContext,
        ClaimPrintJobRequest request,
        IMediator mediator)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId) || request.DeviceId.Length > 64)
        {
            return TypedResults.BadRequest("A device id of up to 64 characters is required.");
        }

        return ToResult(await mediator.Send(new ClaimPrintJobCommand(httpContext.GetRequiredBranchId(), jobId, request.DeviceId.Trim())));
    }

    public static async Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> MarkPrintedAsync(
        int jobId,
        HttpContext httpContext,
        IMediator mediator)
        => ToResult(await mediator.Send(new CompletePrintJobCommand(httpContext.GetRequiredBranchId(), jobId, true, null)));

    public static async Task<Results<NoContent, BadRequest<string>, NotFound, Conflict>> MarkFailedAsync(
        int jobId,
        HttpContext httpContext,
        FailPrintJobRequest request,
        IMediator mediator)
        => ToResult(await mediator.Send(new CompletePrintJobCommand(httpContext.GetRequiredBranchId(), jobId, false, request.Error)));

    public static async Task<Results<NoContent, BadRequest<string>, NotFound>> SetStationReadyAsync(
        int orderId,
        int stationId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        SetOrderReadyRequest request,
        IMediator mediator)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        try
        {
            var found = await mediator.Send(new IdentifiedCommand<SetOrderStationReadyCommand, bool>(
                new SetOrderStationReadyCommand(orderId, stationId, request.Ready), requestId));

            return found ? TypedResults.NoContent() : TypedResults.NotFound();
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    private static Results<NoContent, BadRequest<string>, NotFound, Conflict> ToResult(PrintJobOutcome outcome) => outcome switch
    {
        PrintJobOutcome.Done => TypedResults.NoContent(),
        PrintJobOutcome.Taken => TypedResults.Conflict(),
        _ => TypedResults.NotFound(),
    };
}

public record KitchenStationRequest(
    LocalizedText Name,
    List<int>? CategoryIds,
    bool ShowsOnScreen,
    bool PrintsTickets,
    string? PrinterHost,
    int? PrinterPort,
    int DisplayOrder = 0);

public record ClaimPrintJobRequest(string DeviceId);

public record FailPrintJobRequest(string? Error);
