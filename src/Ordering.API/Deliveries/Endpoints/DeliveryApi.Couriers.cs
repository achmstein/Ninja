#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.Ordering.Infrastructure.Deliveries;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Courier companies: the ones the business lists (the owner keeps them in admin, the till picks
/// from them), and the till's two steps for a delivery a courier carries: give it to the company,
/// and say it was delivered with what the courier collected.
/// </summary>
public static partial class DeliveryApi
{
    internal static RouteGroupBuilder MapCourierRoutes(this RouteGroupBuilder orders)
    {
        var newWork = orders.MapGroup(string.Empty).AddEndpointFilter(DeliveryOnAsync);

        orders.MapGet("/couriers", GetCourierProvidersAsync)
            .WithName("GetCourierProviders")
            .WithSummary("The courier companies the business lists (staff)")
            .WithDescription("Switched-off ones too, last, for the admin to switch back on; the till offers only those switched on, after the branch's riders.")
            .RequireAuthorization("Pos");

        newWork.MapPost("/couriers", AddCourierProviderAsync)
            .WithName("AddCourierProvider")
            .WithSummary("List a courier company the business hands deliveries to (admin)")
            .RequireAuthorization("Admin");

        orders.MapPut("/couriers/{providerId:int}", UpdateCourierProviderAsync)
            .WithName("UpdateCourierProvider")
            .WithSummary("Change a courier company, or switch it off or on (admin)")
            .WithDescription("Switched off, it is offered for no new delivery; the deliveries it carried keep it. Never deleted.")
            .RequireAuthorization("Admin");

        newWork.MapPut("/{orderId:int}/delivery/courier", AssignCourierAsync)
            .WithName("AssignDeliveryCourier")
            .WithSummary("Give a delivery to a courier company instead of a rider, or change who it sent, before it leaves (staff)")
            .WithDescription("The company must be one the business lists and has switched on (code courier.unknown otherwise). A rider who had it no longer does. The fee is the company's usual one when left out.")
            .RequireAuthorization("Pos");

        orders.MapDelete("/{orderId:int}/delivery/courier", UnassignRiderAsync)
            .WithName("UnassignDeliveryCourier")
            .WithSummary("Take a delivery back from its courier company before it leaves (staff)")
            .RequireAuthorization("Pos");

        orders.MapGet("/couriers/{providerId:int}/connection", GetCourierConnectionAsync)
            .WithName("GetCourierConnection")
            .WithSummary("Whether a courier company's system is connected, and where it sends its status (admin)")
            .RequireAuthorization("Admin");

        orders.MapPut("/couriers/{providerId:int}/connection", SetCourierConnectionAsync)
            .WithName("SetCourierConnection")
            .WithSummary("Connect a courier company's system, or disconnect it (admin)")
            .WithDescription("The address takes Ninja's jobs (POST {address}/jobs, POST {address}/jobs/{jobId}/cancel), with the key as a bearer token. Https only. Empty disconnects it, forgetting its key and signing secret; a key left out keeps the one kept. See docs/courier-api.md.")
            .RequireAuthorization("Admin");

        orders.MapPost("/couriers/{providerId:int}/webhook-secret", NewCourierWebhookSecretAsync)
            .WithName("NewCourierWebhookSecret")
            .WithSummary("Make a new signing secret for a connected courier company, shown this once (admin)")
            .WithDescription("The company signs its status calls with it; the one before stops working at once.")
            .RequireAuthorization("Admin");

        orders.MapPost("/couriers/{providerId:int}/test-job", SendCourierTestJobAsync)
            .WithName("SendCourierTestJob")
            .WithSummary("Send a connected courier company a test job, then cancel it, and say what its system answered (admin)")
            .WithDescription("Marked test, with nothing to deliver and nothing to collect. The job id it gives is kept, so a status the company sends for it is checked and answered without touching an order.")
            .RequireAuthorization("Admin");

        orders.MapGet("/couriers/{providerId:int}/calls", GetCourierCallsAsync)
            .WithName("GetCourierCalls")
            .WithSummary("A connected courier company's recent status calls and how each was answered (admin)")
            .WithDescription("Newest first, the last fifty, kept two weeks: what to read when its steps do not arrive (401 a wrong secret or clock, 410 a job it no longer has).")
            .RequireAuthorization("Admin");

        orders.MapPost("/couriers/{providerId:int}/status", ReceiveCourierStatusAsync)
            .WithName("ReceiveCourierStatus")
            .WithSummary("A connected courier company's status for one of its jobs (signed by the company)")
            .WithDescription("Signed, not signed in: X-Ninja-Timestamp (unix seconds, within five minutes) and X-Ninja-Signature (sha256= and the hex HMAC-SHA256 of timestamp + '.' + raw body, keyed with the company's signing secret). 200 applied or sent again; 401 not signed; 404 no such connected company; 410 not the company's job any more; 400 not a status; 409 a step the order cannot take. See docs/courier-api.md.")
            .AllowAnonymous()
            .RequireRateLimiting(DeliveryModule.CourierStatusPolicy)
            .ExcludeFromDescription();

        orders.MapPut("/{orderId:int}/delivery/courier-delivered", MarkCourierDeliveredAsync)
            .WithName("MarkCourierDelivered")
            .WithSummary("A courier handed it over, and collected this much: the bill is settled to the courier company (staff)")
            .WithDescription("Only after it left. The company keeps the cash and owes it to the business; nothing goes into the drawer. Paid online ahead, nothing was collected, whatever is sent. A courier's delivery is never said delivered without it (code courier.amount_required).")
            .RequireAuthorization("Pos");

        return orders;
    }

    public static async Task<Ok<List<CourierProviderView>>> GetCourierProvidersAsync(OrderingContext context)
    {
        var providers = await context.CourierProviders.AsNoTracking()
            .OrderByDescending(p => p.IsActive)
            .ThenBy(p => p.Name)
            .ToListAsync();
        return TypedResults.Ok(providers.Select(CourierProviders.View).ToList());
    }

    public static async Task<Results<Ok<CourierProviderView>, ProblemHttpResult>> AddCourierProviderAsync(
        CourierProviderRequest request, OrderingContext context, TimeProvider time)
    {
        try
        {
            var (name, phone, fee) = CourierProviders.Read(request);
            var provider = context.CourierProviders.Add(new CourierCompany
            {
                Name = name,
                Phone = phone,
                DefaultFee = fee,
                IsActive = request.IsActive,
                CreatedAt = time.GetUtcNow().UtcDateTime,
            }).Entity;
            await context.SaveChangesAsync();
            return TypedResults.Ok(CourierProviders.View(provider));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    public static async Task<Results<Ok<CourierProviderView>, ProblemHttpResult>> UpdateCourierProviderAsync(
        int providerId, CourierProviderRequest request, OrderingContext context)
    {
        try
        {
            var provider = await context.CourierProviders.FindAsync(providerId);
            if (provider is null)
                return OrderingProblems.Of("courier.not_found", "There is no such courier company.");
            var (name, phone, fee) = CourierProviders.Read(request);
            provider.Name = name;
            provider.Phone = phone;
            provider.DefaultFee = fee;
            provider.IsActive = request.IsActive;
            await context.SaveChangesAsync();
            return TypedResults.Ok(CourierProviders.View(provider));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    public static async Task<Results<Ok<CourierConnectionView>, ProblemHttpResult>> GetCourierConnectionAsync(
        int providerId, OrderingContext context, CourierSecrets secrets, ICourierDispatch couriers)
    {
        var provider = await context.CourierProviders.AsNoTracking().FirstOrDefaultAsync(p => p.Id == providerId);
        return provider is null
            ? OrderingProblems.Of("courier.not_found", "There is no such courier company.")
            : TypedResults.Ok(ConnectionView(provider, secrets, couriers));
    }

    public static async Task<Results<Ok<CourierConnectionView>, ProblemHttpResult>> SetCourierConnectionAsync(
        int providerId, CourierConnectionRequest request, OrderingContext context, CourierSecrets secrets, ICourierDispatch couriers)
    {
        var provider = await context.CourierProviders.FindAsync(providerId);
        if (provider is null)
            return OrderingProblems.Of("courier.not_found", "There is no such courier company.");

        var address = request.ApiBaseUrl?.Trim();
        if (string.IsNullOrEmpty(address))
        {
            provider.ApiBaseUrl = null;
            provider.SealedApiKey = null;
            provider.SealedWebhookSecret = null;
        }
        else
        {
            // Https only, but a company's test system on this machine while it builds against the API
            if (!Uri.TryCreate(address, UriKind.Absolute, out var uri)
                || !(uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
                || address.Length > 500 || !string.IsNullOrEmpty(uri.Query))
                return OrderingProblems.Of("courier.address_invalid", "Give the address of the company's system, starting https://.");
            if (!secrets.CanSeal)
                return OrderingProblems.Of("courier.cannot_keep_secrets", "This business can't keep a courier company's key yet; it can after its next upgrade.");
            provider.ApiBaseUrl = address.TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(request.ApiKey))
            {
                if (request.ApiKey.Trim().Length > 500)
                    return OrderingProblems.Of("courier.key_invalid", "The key is longer than 500 characters.");
                provider.SealedApiKey = secrets.Seal(request.ApiKey.Trim());
            }
        }
        await context.SaveChangesAsync();
        return TypedResults.Ok(ConnectionView(provider, secrets, couriers));
    }

    public static async Task<Results<Ok<CourierWebhookSecretView>, ProblemHttpResult>> NewCourierWebhookSecretAsync(
        int providerId, OrderingContext context, CourierSecrets secrets, ICourierDispatch couriers)
    {
        var provider = await context.CourierProviders.FindAsync(providerId);
        if (provider is null)
            return OrderingProblems.Of("courier.not_found", "There is no such courier company.");
        if (!provider.IsConnected)
            return OrderingProblems.Of("courier.not_connected", "Connect the company's system first.");
        if (!secrets.CanSeal)
            return OrderingProblems.Of("courier.cannot_keep_secrets", "This business can't keep a courier company's secret yet; it can after its next upgrade.");
        var secret = CourierSecrets.NewWebhookSecret();
        provider.SealedWebhookSecret = secrets.Seal(secret);
        await context.SaveChangesAsync();
        return TypedResults.Ok(new CourierWebhookSecretView(secret, couriers.StatusUrl(provider.Id)));
    }

    public static async Task<Results<Ok<CourierTestJobView>, ProblemHttpResult>> SendCourierTestJobAsync(
        int providerId, OrderingContext context, ICourierDispatch couriers, CancellationToken ct)
    {
        var provider = await context.CourierProviders.AsNoTracking().FirstOrDefaultAsync(p => p.Id == providerId, ct);
        if (provider is null)
            return OrderingProblems.Of("courier.not_found", "There is no such courier company.");
        if (!provider.IsConnected)
            return OrderingProblems.Of("courier.not_connected", "Connect the company's system first.");
        return TypedResults.Ok(await couriers.SendTestJobAsync(provider, ct));
    }

    public static async Task<Ok<List<CourierCallView>>> GetCourierCallsAsync(int providerId, OrderingContext context)
    {
        var calls = await context.CourierStatusCalls.AsNoTracking()
            .Where(c => c.CompanyId == providerId)
            .OrderByDescending(c => c.ReceivedAt).ThenByDescending(c => c.Id)
            .Take(50)
            .Select(c => new CourierCallView(c.ReceivedAt, c.Status, c.OrderId, c.JobId, c.Sequence, c.Result, c.Detail))
            .ToListAsync();
        return TypedResults.Ok(calls);
    }

    public static async Task<IResult> ReceiveCourierStatusAsync(
        int providerId, HttpRequest request, CourierStatusReceiver receiver, CourierCallLog log, CancellationToken ct)
    {
        var (result, code, detail, body) = await AnswerCourierStatusAsync(providerId, request, receiver, ct);
        // Kept with its answer, whatever it was: what the owner reads when the company's steps do not arrive
        if (body is not null)
            await log.RecordAsync(providerId, body, code, detail);
        return result;
    }

    private static async Task<(IResult Result, int Code, string? Detail, string? Body)> AnswerCourierStatusAsync(
        int providerId, HttpRequest request, CourierStatusReceiver receiver, CancellationToken ct)
    {
        using var reader = new StreamReader(request.Body);
        var body = await reader.ReadToEndAsync(ct);
        if (body.Length > 64 * 1024)
            return Problem(StatusCodes.Status413PayloadTooLarge, "The status is too long.", null);
        try
        {
            var (outcome, detail) = await receiver.ReceiveAsync(
                providerId, body,
                request.Headers[CourierStatusReceiver.TimestampHeader].FirstOrDefault(),
                request.Headers[CourierStatusReceiver.SignatureHeader].FirstOrDefault(),
                ct);
            return outcome switch
            {
                CourierStatusOutcome.Applied => (TypedResults.Ok(), StatusCodes.Status200OK, detail, body),
                CourierStatusOutcome.Unsigned => Problem(StatusCodes.Status401Unauthorized, "Not signed by the company, or too old.", body),
                // No such company: nothing is kept for a call to a number the business does not list
                CourierStatusOutcome.UnknownCompany => Problem(StatusCodes.Status404NotFound, "No such connected courier company.", body),
                CourierStatusOutcome.NotYourJob => Problem(StatusCodes.Status410Gone, "The order is not this company's job any more.", body),
                _ => Problem(StatusCodes.Status400BadRequest, detail ?? "Not a status.", body),
            };
        }
        catch (OrderingDomainException ex)
        {
            var problem = OrderingProblems.From(ex);
            return (problem, problem.StatusCode, $"{ex.Code}: {ex.Message}", body);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Two statuses crossed: the company sends this one again
            return Problem(StatusCodes.Status503ServiceUnavailable, "Send it again.", body);
        }

        static (IResult, int, string?, string?) Problem(int code, string detail, string? body) =>
            (TypedResults.Problem(detail, statusCode: code), code, detail, body);
    }

    private static CourierConnectionView ConnectionView(CourierCompany p, CourierSecrets secrets, ICourierDispatch couriers) =>
        new(p.IsConnected, p.ApiBaseUrl, p.SealedApiKey is not null, p.SealedWebhookSecret is not null, couriers.StatusUrl(p.Id), secrets.CanSeal);

    public static Task<Results<NoContent, ProblemHttpResult>> AssignCourierAsync(
        int orderId, AssignCourierRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new AssignDeliveryCourierCommand(
            orderId, httpContext.GetRequiredBranchId(), request.ProviderId, request.CourierName, request.CourierPhone, request.Fee), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkCourierDeliveredAsync(
        int orderId, CourierDeliveredRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkCourierDeliveredCommand(orderId, httpContext.GetRequiredBranchId(), request.Collected), mediator);
}
