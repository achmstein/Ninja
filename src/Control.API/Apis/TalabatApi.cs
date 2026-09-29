using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <param name="Kind">Accepted, Rejected, Prepared or PickedUp.</param>
/// <param name="Url">Where the order said to send this change: an address on the middleware.</param>
public sealed record TalabatRelayRequest(string Token, string Kind, string Url, string RemoteOrderId, string? Reason, DateTime? AcceptanceTime);

/// <summary>
/// Talabat's plugin, for every café at once (Delivery Hero's POS Plugin API).
/// Talabat knows one integration — Ninja — at one address, and routes by the
/// remote id each branch was registered with ("{slug}-{branchId}"). Its calls
/// land here, are checked against its signature, and go on to the café's own
/// stack; what the café does with an order comes back through the relay and
/// goes on to Talabat under Ninja's account.
/// </summary>
public static class TalabatApi
{
    public static IEndpointRouteBuilder MapTalabatApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/talabat").WithTags("Talabat").AllowAnonymous().ExcludeFromDescription();

        // Talabat's side, signed with its secret
        api.MapPost("/order/{remoteId}", Dispatch).WithName("TalabatDispatchOrder");
        api.MapPut("/remoteId/{remoteId}/remoteOrder/{remoteOrderId}/posOrderStatus", OrderStatus).WithName("TalabatOrderStatus");
        api.MapPut("/remoteId/{remoteId}/availability", Availability).WithName("TalabatVendorAvailability");
        api.MapGet("/menuimport/{remoteId}", MenuImport).WithName("TalabatMenuImport");
        api.MapPost("/catalog-callback", CatalogCallback).WithName("TalabatCatalogCallback");

        // The cafés' side, each with its own key
        api.MapPost("/relay/status", RelayStatus).WithName("TalabatRelayStatus");

        return app;
    }

    /// <summary>
    /// A new order for a branch. Answered within seconds, as Talabat asks:
    /// 200 with our order id once the café has it; 400 with Talabat's reason
    /// when it cannot take it as sent (Talabat rejects it at once); 502 when
    /// the café's stack cannot be reached, so Talabat tries again.
    /// </summary>
    public static async Task<IResult> Dispatch(
        HttpContext http, string remoteId, ControlContext context, IStackProxy stacks, IOptions<PlatformOptions> options, ILoggerFactory loggers, CancellationToken ct)
    {
        var logger = loggers.CreateLogger("Ninja.Control.API.Talabat");
        if (Refuse(http, options.Value) is { } refused) return refused;

        var (tenant, branchId) = await FindAsync(context, remoteId, ct);
        if (tenant is null)
        {
            logger.LogWarning("Talabat dispatched an order for {RemoteId}, which is no café here", remoteId);
            return Rejected("CLOSED", $"No café is registered as {remoteId}.");
        }
        if (tenant.Status != TenantStatus.Running)
        {
            logger.LogWarning("Talabat dispatched an order for {RemoteId}, but {Slug} is {Status}", remoteId, tenant.Slug, tenant.Status);
            return tenant.Status == TenantStatus.Upgrading
                ? Results.StatusCode(StatusCodes.Status502BadGateway)
                : Rejected("CLOSED", "The café is not open on Ninja.");
        }

        var body = await ReadBodyAsync(http, ct);
        HttpResponseMessage response;
        try
        {
            response = await stacks.SendAsync(tenant, HttpMethod.Post, "/api/orders/talabat?api-version=1.0",
                new StringContent(body, Encoding.UTF8, "application/json"), StackAuth.Control, ct, branchId);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Talabat order for {RemoteId} could not reach {Slug}'s stack", remoteId, tenant.Slug);
            return Results.StatusCode(StatusCodes.Status502BadGateway);
        }

        using (response)
        {
            var answer = await ReadJsonAsync(response, ct);
            if (response.IsSuccessStatusCode && answer?["remoteOrderId"]?.GetValue<string>() is { } orderId)
            {
                logger.LogInformation("Talabat order for {RemoteId} is {Slug} order {OrderId}", remoteId, tenant.Slug, orderId);
                return Results.Ok(new { remoteResponse = new { remoteOrderId = orderId } });
            }
            if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
            {
                return Rejected(answer?["reason"]?.GetValue<string>() ?? "TECHNICAL_PROBLEM", answer?["message"]?.GetValue<string>());
            }

            logger.LogError("Talabat order for {RemoteId}: {Slug}'s stack answered {Status}", remoteId, tenant.Slug, (int)response.StatusCode);
            return Results.StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    /// <summary>Talabat says an order was cancelled, picked up, or something the café may want to know.</summary>
    public static async Task<IResult> OrderStatus(
        HttpContext http, string remoteId, string remoteOrderId, ControlContext context, IStackProxy stacks, IOptions<PlatformOptions> options, ILoggerFactory loggers, CancellationToken ct)
    {
        var logger = loggers.CreateLogger("Ninja.Control.API.Talabat");
        if (Refuse(http, options.Value) is { } refused) return refused;
        if (!int.TryParse(remoteOrderId, out var orderId)) return Results.NotFound();

        var (tenant, branchId) = await FindAsync(context, remoteId, ct);
        if (tenant is null) return Results.NotFound();

        var body = await ReadBodyAsync(http, ct);
        try
        {
            using var response = await stacks.SendAsync(tenant, HttpMethod.Put, $"/api/orders/talabat/{orderId}/status?api-version=1.0",
                new StringContent(body, Encoding.UTF8, "application/json"), StackAuth.Control, ct, branchId);
            if (response.StatusCode == HttpStatusCode.NotFound) return Results.NotFound();
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Talabat status for {Slug} order {OrderId}: the stack answered {Status}", tenant.Slug, orderId, (int)response.StatusCode);
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }
            return Results.Ok();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Talabat status for {Slug} order {OrderId} could not reach the stack", tenant.Slug, orderId);
            return Results.StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    /// <summary>Talabat opened or closed a branch. Taken, and not acted on yet.</summary>
    public static IResult Availability(HttpContext http, string remoteId, IOptions<PlatformOptions> options, ILoggerFactory loggers)
    {
        if (Refuse(http, options.Value) is { } refused) return refused;
        loggers.CreateLogger("Ninja.Control.API.Talabat").LogInformation("Talabat changed {RemoteId}'s availability", remoteId);
        return Results.Ok();
    }

    /// <summary>Talabat asks for a branch's menu. The menu is sent from the café's catalog; until then, taken and not acted on.</summary>
    public static IResult MenuImport(HttpContext http, string remoteId, IOptions<PlatformOptions> options, ILoggerFactory loggers)
    {
        if (Refuse(http, options.Value) is { } refused) return refused;
        loggers.CreateLogger("Ninja.Control.API.Talabat").LogInformation("Talabat asked for {RemoteId}'s menu", remoteId);
        return Results.StatusCode(StatusCodes.Status202Accepted);
    }

    /// <summary>How a menu Ninja sent was taken.</summary>
    public static async Task<IResult> CatalogCallback(HttpContext http, IOptions<PlatformOptions> options, ILoggerFactory loggers, CancellationToken ct)
    {
        if (Refuse(http, options.Value) is { } refused) return refused;
        loggers.CreateLogger("Ninja.Control.API.Talabat").LogInformation("Talabat catalog import: {Body}", await ReadBodyAsync(http, ct));
        return Results.Ok();
    }

    /// <summary>
    /// A café tells Talabat what it did with an order: the stack names itself
    /// and shows its key, and the change goes to the middleware address the
    /// order gave for it, under Ninja's account. The middleware's own answer
    /// comes back as it was, for the stack to retry or give up on.
    /// </summary>
    public static async Task<IResult> RelayStatus(
        HttpContext http, TalabatRelayRequest request, TalabatMiddleware middleware, IOptions<PlatformOptions> options, ControlContext context, ILoggerFactory loggers, CancellationToken ct)
    {
        var logger = loggers.CreateLogger("Ninja.Control.API.Talabat");
        var platform = options.Value;
        if (!platform.Talabat.Configured || string.IsNullOrWhiteSpace(platform.EncryptionKey))
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        var slug = http.Request.Headers["X-Ninja-Tenant"].ToString();
        if (!TalabatNaming.RelayKeyMatches(slug, platform.EncryptionKey, http.Request.Headers["X-Ninja-Relay-Key"].ToString())
            || !await context.Tenants.AnyAsync(t => t.Slug == slug && t.Status != TenantStatus.Destroyed, ct))
            return Results.Unauthorized();

        if (!middleware.IsMiddlewareUrl(request.Url))
        {
            logger.LogWarning("{Slug} asked to report order {Token} to {Url}, which is not Talabat's middleware", slug, request.Token, request.Url);
            return Results.BadRequest("Not Talabat's address.");
        }

        object? body = request.Kind switch
        {
            "Accepted" => new { status = "order_accepted", acceptanceTime = (request.AcceptanceTime ?? DateTime.UtcNow.AddMinutes(15)).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"), remoteOrderId = request.RemoteOrderId },
            "Rejected" => new { status = "order_rejected", reason = request.Reason ?? "TOO_BUSY", message = (string?)null },
            "PickedUp" => new { status = "order_picked_up" },
            "Prepared" => null,
            _ => "unknown",
        };
        if (body is "unknown") return Results.BadRequest($"Unknown change {request.Kind}.");

        var result = await middleware.PostAsync(request.Url, body, ct);
        logger.LogInformation("{Slug} told Talabat order {Token} was {Kind}: {Status}", slug, request.Token, request.Kind, result.Status);
        return Results.Text(result.Body, "application/json", statusCode: result.Status);
    }

    /// <summary>Anything without the middleware's signature, or while the integration is off, is turned away.</summary>
    private static IResult? Refuse(HttpContext http, PlatformOptions platform)
    {
        if (!platform.Talabat.Configured) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        return TalabatJwt.IsFromMiddleware(http.Request.Headers.Authorization.ToString(), platform.Talabat.Secret!)
            ? null
            : Results.Unauthorized();
    }

    private static async Task<(Tenant? Tenant, int BranchId)> FindAsync(ControlContext context, string remoteId, CancellationToken ct)
    {
        if (!TalabatNaming.TryParseRemoteId(remoteId, out var slug, out var branchId)) return (null, 0);
        var tenant = await context.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug && t.Status != TenantStatus.Destroyed, ct);
        return (tenant, branchId);
    }

    private static IResult Rejected(string reason, string? message)
        => Results.BadRequest(new { reason, message });

    private static async Task<string> ReadBodyAsync(HttpContext http, CancellationToken ct)
    {
        using var reader = new StreamReader(http.Request.Body, Encoding.UTF8);
        return await reader.ReadToEndAsync(ct);
    }

    private static async Task<JsonObject?> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            return JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }
}
