#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;

/// <summary>
/// The Ninja Print Connector: a Windows service in the shop that prints the
/// kitchen's tickets on any printer Windows knows. An owner makes a pairing
/// code in admin; the connector trades it once for a key and from then on
/// signs every call with it — no staff sign-in, no branch header, nothing
/// in the shop opened to the internet. The key names its branch.
/// </summary>
public static class PrintConnectorApi
{
    public const string KeyHeader = "X-Connector-Key";

    public static RouteGroupBuilder MapPrintConnectorApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/kitchen").HasApiVersion(1.0);

        // --- The back office -----------------------------------------------------

        api.MapPost("/connectors/pairing", CreatePairingAsync)
            .WithName("CreateConnectorPairing")
            .WithSummary("Make a code to pair a print connector with this branch (admin)")
            .WithDescription("Good once, for ten minutes. The connector's tickets print in the language given.")
            .RequireAuthorization("Admin");

        api.MapGet("/connectors", GetConnectorsAsync)
            .WithName("GetPrintConnectors")
            .WithSummary("The print connectors paired with this branch (staff)")
            .WithDescription("Each with the printers Windows has on its PC and when it last checked in.")
            .RequireAuthorization("Pos");

        api.MapDelete("/connectors/{connectorId:int}", DeleteConnectorAsync)
            .WithName("DeletePrintConnector")
            .WithSummary("Unpair a print connector (admin)")
            .WithDescription("Refused while a station prints on one of its printers. Its key stops working at once.")
            .RequireAuthorization("Admin");

        // --- The connector itself ---------------------------------------------------

        api.MapPost("/connector/pair", PairAsync)
            .WithName("PairPrintConnector")
            .WithSummary("Trade a pairing code for a connector key (print connector)")
            .WithDescription("Anonymous: the code is the proof. The key is returned once and never again.")
            .AllowAnonymous()
            .RequireRateLimiting(OrderRateLimiting.GuestCreatePolicy);

        api.MapPost("/connector/heartbeat", HeartbeatAsync)
            .WithName("PrintConnectorHeartbeat")
            .WithSummary("Check in, with the printers Windows has (print connector)")
            .AllowAnonymous();

        api.MapGet("/connector/jobs", GetJobsAsync)
            .WithName("GetPrintConnectorJobs")
            .WithSummary("Tickets this connector can print (print connector)")
            .WithDescription("Its own stations' tickets, and those for network printers any device may print.")
            .AllowAnonymous();

        api.MapPost("/connector/jobs/{jobId:int}/claim", ClaimAsync)
            .WithName("ClaimPrintConnectorJob")
            .AllowAnonymous();

        api.MapPost("/connector/jobs/{jobId:int}/printed", PrintedAsync)
            .WithName("MarkPrintConnectorJobPrinted")
            .AllowAnonymous();

        api.MapPost("/connector/jobs/{jobId:int}/failed", FailedAsync)
            .WithName("MarkPrintConnectorJobFailed")
            .AllowAnonymous();

        return api;
    }

    // --- The back office ------------------------------------------------------------

    public static async Task<Ok<ConnectorPairingView>> CreatePairingAsync(
        HttpContext httpContext,
        CreatePairingRequest request,
        IPrintConnectorRepository connectors)
    {
        var pairing = ConnectorPairing.New(httpContext.GetRequiredBranchId(), request.Language, DateTime.UtcNow);
        connectors.AddPairing(pairing);
        await connectors.UnitOfWork.SaveChangesAsync();
        return TypedResults.Ok(new ConnectorPairingView(pairing.Code, pairing.ExpiresAt));
    }

    public static async Task<Ok<List<PrintConnectorView>>> GetConnectorsAsync(
        HttpContext httpContext,
        IPrintConnectorRepository connectors)
    {
        var list = await connectors.GetForBranchAsync(httpContext.GetRequiredBranchId());
        return TypedResults.Ok(list.Select(PrintConnectorView.From).ToList());
    }

    public static async Task<Results<NoContent, NotFound, BadRequest<string>>> DeleteConnectorAsync(
        int connectorId,
        HttpContext httpContext,
        IPrintConnectorRepository connectors,
        IKitchenStationRepository stations)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var connector = await connectors.GetAsync(connectorId);
        if (connector is null || connector.BranchId != branchId)
        {
            return TypedResults.NotFound();
        }

        if ((await stations.GetForBranchAsync(branchId)).Any(s => s.ConnectorId == connectorId))
        {
            return TypedResults.BadRequest("A station prints on one of this connector's printers; move it to another printer first.");
        }

        connectors.Remove(connector);
        await connectors.UnitOfWork.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // --- The connector itself ----------------------------------------------------------

    public static async Task<Results<Ok<ConnectorPairedView>, BadRequest<string>>> PairAsync(
        PairConnectorRequest request,
        IPrintConnectorRepository connectors)
    {
        var pairing = await connectors.GetPairingAsync(request.Code ?? string.Empty);
        if (pairing is null)
        {
            return TypedResults.BadRequest("That pairing code is not one we made. Check it, or make a new one in admin.");
        }

        try
        {
            var (connector, key) = PrintConnector.Pair(pairing, request.MachineName ?? string.Empty, DateTime.UtcNow);
            connectors.Add(connector);
            await connectors.UnitOfWork.SaveChangesAsync();
            return TypedResults.Ok(new ConnectorPairedView(connector.Id, $"{connector.Id}.{key}", connector.BranchId, connector.Language));
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<NoContent, UnauthorizedHttpResult>> HeartbeatAsync(
        HttpContext httpContext,
        ConnectorHeartbeatRequest request,
        IPrintConnectorRepository connectors)
    {
        var connector = await AuthenticateAsync(httpContext, connectors);
        if (connector is null)
        {
            return TypedResults.Unauthorized();
        }

        connector.Seen(request.Printers, DateTime.UtcNow);
        await connectors.UnitOfWork.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok<List<KitchenTicket>>, UnauthorizedHttpResult>> GetJobsAsync(
        HttpContext httpContext,
        IPrintConnectorRepository connectors,
        IKitchenQueries queries)
    {
        var connector = await AuthenticateAsync(httpContext, connectors);
        if (connector is null)
        {
            return TypedResults.Unauthorized();
        }

        // Asking is checking in: the admin sees it alive
        connector.Seen(null, DateTime.UtcNow);
        await connectors.UnitOfWork.SaveChangesAsync();

        var tickets = await queries.GetPendingTicketsAsync(connector.BranchId);
        return TypedResults.Ok(tickets
            .Where(t => t.ConnectorId == connector.Id || (t.ConnectorId is null && t.PrinterHost is not null))
            .ToList());
    }

    public static async Task<Results<NoContent, NotFound, Conflict, UnauthorizedHttpResult>> ClaimAsync(
        int jobId,
        HttpContext httpContext,
        IPrintConnectorRepository connectors,
        IMediator mediator)
    {
        var connector = await AuthenticateAsync(httpContext, connectors);
        if (connector is null)
        {
            return TypedResults.Unauthorized();
        }

        return await mediator.Send(new ClaimPrintJobCommand(connector.BranchId, jobId, $"connector-{connector.Id}")) switch
        {
            PrintJobOutcome.Done => TypedResults.NoContent(),
            PrintJobOutcome.Taken => TypedResults.Conflict(),
            _ => TypedResults.NotFound(),
        };
    }

    public static Task<Results<NoContent, NotFound, Conflict, UnauthorizedHttpResult>> PrintedAsync(
        int jobId, HttpContext httpContext, IPrintConnectorRepository connectors, IMediator mediator)
        => CompleteAsync(jobId, true, null, httpContext, connectors, mediator);

    public static Task<Results<NoContent, NotFound, Conflict, UnauthorizedHttpResult>> FailedAsync(
        int jobId, FailPrintJobRequest request, HttpContext httpContext, IPrintConnectorRepository connectors, IMediator mediator)
        => CompleteAsync(jobId, false, request.Error, httpContext, connectors, mediator);

    private static async Task<Results<NoContent, NotFound, Conflict, UnauthorizedHttpResult>> CompleteAsync(
        int jobId, bool printed, string? error, HttpContext httpContext, IPrintConnectorRepository connectors, IMediator mediator)
    {
        var connector = await AuthenticateAsync(httpContext, connectors);
        if (connector is null)
        {
            return TypedResults.Unauthorized();
        }

        return await mediator.Send(new CompletePrintJobCommand(connector.BranchId, jobId, printed, error)) == PrintJobOutcome.Done
            ? TypedResults.NoContent()
            : TypedResults.NotFound();
    }

    /// <summary>The connector the key belongs to: "{id}.{secret}", checked in constant time.</summary>
    private static async Task<PrintConnector?> AuthenticateAsync(HttpContext httpContext, IPrintConnectorRepository connectors)
    {
        var header = httpContext.Request.Headers[KeyHeader].ToString();
        var dot = header.IndexOf('.');
        if (dot <= 0 || !int.TryParse(header[..dot], out var connectorId))
        {
            return null;
        }

        var connector = await connectors.GetAsync(connectorId);
        return connector is not null && connector.Holds(header[(dot + 1)..]) ? connector : null;
    }
}

public record CreatePairingRequest(string? Language);

public record ConnectorPairingView(string Code, DateTime ExpiresAt);

public record PairConnectorRequest(string? Code, string? MachineName);

/// <summary>What the connector keeps: who it is, the key it signs with, and the language its tickets print in.</summary>
public record ConnectorPairedView(int ConnectorId, string Key, int BranchId, string Language);

public record ConnectorHeartbeatRequest(List<string>? Printers);

public record PrintConnectorView(int Id, string Name, DateTime PairedAt, DateTime? LastSeenAt, bool IsOnline, List<string> Printers)
{
    /// <summary>It asks for tickets every few seconds; two minutes of silence is a PC that is off.</summary>
    public static PrintConnectorView From(PrintConnector c) => new(
        c.Id, c.Name, c.PairedAt, c.LastSeenAt,
        c.LastSeenAt is { } seen && DateTime.UtcNow - seen < TimeSpan.FromMinutes(2),
        c.Printers);
}
