#nullable enable
using System.ComponentModel;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Sales.API.Apis;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.API.Extensions;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.API.Payments;

/// <param name="PayerName">The name the guest gives; a signed-in customer's own name when left out.</param>
public sealed record StartPaymentRequest(SplitMode Mode, IReadOnlyList<int>? LineIds, int? Parts, int? Of, decimal? Amount, string? PayerName, string? PayerPhone);

/// <param name="SecretKey">Null leaves the stored key; an empty string removes it.</param>
/// <param name="HmacSecret">Likewise.</param>
public sealed record PaymentSettingsRequest(
    string Currency,
    string? SecretKey,
    string? PublicKey,
    string? HmacSecret,
    int? CardIntegrationId,
    int? WalletIntegrationId,
    int? ApplePayIntegrationId,
    FeeMode FeeMode,
    decimal FeePercent,
    decimal FeeFixed,
    bool AllowItems,
    bool AllowEqual,
    bool AllowCustom);

/// <summary>
/// Online payments (docs/online-payments-plan.md): a guest pays or splits their
/// bill from their phone through the café's own payment provider account.
/// The gateway answers 402 for all of it when the café has not bought the
/// module, except the provider's callback, which always lands.
/// </summary>
public static class PaymentsApi
{
    public const string CallbackPath = "/api/sales/payments/paymob/callback";

    public static IEndpointRouteBuilder MapPaymentsApi(this IEndpointRouteBuilder app)
    {
        var api = app.NewVersionedApi("Payments")
            .MapGroup("api/sales/payments")
            .HasApiVersion(1.0);

        // The guest's side: signed in, or a guest known by the id their browser sends
        api.MapGet("/places/{placeId:int}", GetPlaceBill)
            .AllowAnonymous()
            .WithName("GetPlaceBillToPay")
            .WithSummary("The open bill at a table, as a guest pays it")
            .WithDescription("For whoever is at the table: its lines with each one's share of the total and whether someone has paid for it, what is paid, held and left, and how the café lets guests split. 404 when nothing is open there.");

        api.MapGet("/tickets/{ticketId:int}", GetTicketBill)
            .AllowAnonymous()
            .WithName("GetBillToPay")
            .WithSummary("A bill the caller is on, as they pay it");

        api.MapPost("/tickets/{ticketId:int}", StartPayment)
            .AllowAnonymous()
            .WithName("StartOnlinePayment")
            .WithSummary("Start paying a share of a bill; answers where to send the guest to pay")
            .WithDescription("Full: what is left. Items: the lines picked. Equal: parts of N. Custom: an amount up to what is left. The share is held for 15 minutes while the guest is at the provider's checkout.");

        api.MapGet("/{key:guid}", GetPayment)
            .AllowAnonymous()
            .WithName("GetOnlinePayment")
            .WithSummary("How a payment stands, for the page the guest comes back to")
            .WithDescription("Only the provider's signed callback changes it; the guest's return proves nothing.");

        // The staff's side
        api.MapGet("/tickets/{ticketId:int}/online", ListForTicket)
            .RequireAuthorization("Pos")
            .WithName("ListOnlinePayments")
            .WithSummary("Online payments on a bill, for the till");

        // A demo's pretend checkout: the guest's own page says how it went
        api.MapPost("/{key:guid}/simulate", Simulate)
            .AllowAnonymous()
            .WithName("SimulateOnlinePayment")
            .WithSummary("A demo café's pretend payment: paid or declined, as the guest picks")
            .WithDescription("Only on a stack that takes simulated payments, and only for a payment made through the simulation; nothing else can be marked paid this way.");

        // A checkout left unfinished: its payer takes it back, or the till lets it go
        api.MapPost("/{key:guid}/cancel", Cancel)
            .AllowAnonymous()
            .WithName("CancelOnlinePayment")
            .WithSummary("Let a pending payment go, so its share is free again at once")
            .WithDescription("The guest who started it (signed in, or by X-Guest-Id), or the till. A payment the provider later reports paid is still paid.");

        api.MapPost("/{key:guid}/refund", Refund)
            .RequireAuthorization("Pos")
            .WithName("RefundOnlinePayment")
            .WithSummary("Give an online payment back through the provider, while its bill is open");

        api.MapGet("/settings", GetSettings)
            .RequireAuthorization("Owner")
            .WithName("GetPaymentSettings")
            .WithSummary("How the café takes payments at the table; secrets only as whether they are set");

        api.MapPut("/settings", SaveSettings)
            .RequireAuthorization("Owner")
            .WithName("SavePaymentSettings")
            .WithSummary("Change the café's payment account, fee and split options");

        // The provider calls without an api-version, and signs what it sends
        app.MapPost(CallbackPath, Callback)
            .AllowAnonymous()
            .WithName("PaymobCallback")
            .WithSummary("Paymob's transaction callback, checked against the café's HMAC secret")
            .ExcludeFromDescription();

        return app;
    }

    public static async Task<Results<Ok<PayView>, NotFound>> GetPlaceBill(
        HttpContext http,
        [FromServices] ITicketRepository tickets,
        [FromServices] PayReader reader,
        int placeId,
        [Description("The branch the table is in")] int branchId)
    {
        var ticket = await tickets.FindOpenByPlaceAsync(placeId, branchId);
        return ticket is null ? TypedResults.NotFound() : TypedResults.Ok(await reader.ReadAsync(ticket, http));
    }

    public static async Task<Results<Ok<PayView>, NotFound, UnauthorizedHttpResult>> GetTicketBill(
        HttpContext http,
        [FromServices] ITicketRepository tickets,
        [FromServices] IOnlinePaymentRepository payments,
        [FromServices] PayReader reader,
        int ticketId)
    {
        var (userId, guestId) = Caller(http);
        if (userId is null && guestId is null) return TypedResults.Unauthorized();
        var ticket = await tickets.GetAsync(ticketId);
        if (ticket is null || !await OnBillAsync(ticket, payments, userId, guestId)) return TypedResults.NotFound();
        return TypedResults.Ok(await reader.ReadAsync(ticket, http));
    }

    public static async Task<Results<Ok<StartedPayment>, BadRequest<ProblemDetails>, UnauthorizedHttpResult>> StartPayment(
        HttpContext http,
        [FromServices] IMediator mediator,
        int ticketId,
        StartPaymentRequest request)
    {
        var (userId, guestId) = Caller(http);
        var payer = userId ?? guestId;
        if (payer is null) return TypedResults.Unauthorized();
        var name = string.IsNullOrWhiteSpace(request.PayerName) ? http.User.GetUserName() : request.PayerName.Trim();
        try
        {
            var started = await mediator.Send(new StartOnlinePaymentCommand(
                ticketId,
                new ShareRequest(request.Mode, request.LineIds, request.Parts, request.Of, request.Amount),
                payer,
                name,
                request.PayerPhone));
            return TypedResults.Ok(started);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
        catch (PaymentProviderException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message, Type = "provider" });
        }
    }

    public static async Task<Results<Ok<PaymentStatusView>, NotFound>> GetPayment(
        [FromServices] IOnlinePaymentRepository payments,
        [FromServices] ITicketRepository tickets,
        Guid key)
    {
        var payment = await payments.GetByKeyAsync(key);
        if (payment is null) return TypedResults.NotFound();
        var ticket = await tickets.GetAsync(payment.TicketId);
        return TypedResults.Ok(new PaymentStatusView(
            payment.Key, payment.TicketId, payment.Status.ToString(), payment.Amount, payment.Fee, payment.Charged,
            payment.Currency, payment.FailureReason, ticket is { Status: not TicketStatus.Open }));
    }

    public static async Task<Ok<List<OnlinePaymentView>>> ListForTicket([FromServices] IOnlinePaymentRepository payments, int ticketId)
    {
        var list = await payments.ListForTicketAsync(ticketId);
        return TypedResults.Ok(list
            .Where(p => p.Status is OnlinePaymentStatus.Paid or OnlinePaymentStatus.Refunded or OnlinePaymentStatus.Pending)
            .Select(p => new OnlinePaymentView(p.Key, p.Mode.ToString(), p.PayerName, p.Amount, p.Fee, p.Status.ToString(), p.CreatedAt, p.PaidAt, p.TransactionId, p.RefundedAt))
            .ToList());
    }

    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>, UnauthorizedHttpResult>> Cancel(
        HttpContext http, [FromServices] IMediator mediator, Guid key)
    {
        // The till may let any checkout go; a guest only their own
        var staff = ClaimsPrincipalExtensions.PosRoles.Any(http.User.IsInRole);
        var (userId, guestId) = Caller(http);
        var payer = staff ? null : userId ?? guestId;
        if (!staff && payer is null) return TypedResults.Unauthorized();
        try
        {
            return await mediator.Send(new CancelOnlinePaymentCommand(key, payer, staff ? http.GetActor() : payer!))
                ? TypedResults.NoContent()
                : TypedResults.NotFound();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    public static async Task<Results<NoContent, BadRequest<ProblemDetails>>> Refund(HttpContext http, [FromServices] IMediator mediator, Guid key)
    {
        try
        {
            await mediator.Send(new RefundOnlinePaymentCommand(key, http.GetActor()));
            return TypedResults.NoContent();
        }
        catch (Exception ex) when (ex is SalesDomainException or PaymentProviderException)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    public static async Task<Ok<PaymentSettingsView>> GetSettings(
        [FromServices] IOnlinePaymentRepository payments,
        [FromServices] SecretSealer sealer,
        [FromServices] PaymentProviders providers,
        [FromServices] IOptions<PaymentsOptions> options)
    {
        var settings = await payments.GetSettingsAsync();
        return TypedResults.Ok(PaymentSettingsView.From(settings, sealer.CanSeal, CallbackUrl(options.Value), providers.IsSimulated(settings)));
    }

    public sealed record SimulateRequest(bool Paid);

    public static async Task<Results<Ok<PaymentStatusView>, NotFound, BadRequest<ProblemDetails>>> Simulate(
        [FromServices] IOnlinePaymentRepository payments,
        [FromServices] ITicketRepository tickets,
        [FromServices] PaymentProviders providers,
        [FromServices] IMediator mediator,
        Guid key,
        SimulateRequest request)
    {
        var payment = await payments.GetByKeyAsync(key);
        if (payment is null || !providers.SimulationAllowed || payment.Provider != SimulatedPaymentProvider.ProviderName)
            return TypedResults.NotFound();
        if (payment.Status != OnlinePaymentStatus.Pending)
            return TypedResults.BadRequest(new ProblemDetails { Detail = "This payment is already " + payment.Status.ToString().ToLowerInvariant() + "." });

        var reference = payment.Key.ToString("N");
        var confirmed = await mediator.Send(new ConfirmOnlinePaymentCommand(
            new CallbackOutcome(reference, reference, $"sim-{reference}", request.Paid, false, payment.Charged, request.Paid ? null : "Declined in the demo"),
            SimulatedPaymentProvider.ProviderName));
        if (confirmed is { Paid: true })
        {
            try
            {
                await mediator.Send(new SettlePaidOnlineCommand(confirmed.TicketId));
            }
            catch (SalesDomainException)
            {
                // Paid is paid; the till settles what could not settle itself
            }
        }
        return (await GetPayment(payments, tickets, key)).Result is Ok<PaymentStatusView> ok ? ok : TypedResults.NotFound();
    }

    public static async Task<Results<Ok<PaymentSettingsView>, BadRequest<ProblemDetails>>> SaveSettings(
        [FromServices] IMediator mediator,
        [FromServices] SecretSealer sealer,
        [FromServices] PaymentProviders providers,
        [FromServices] IOptions<PaymentsOptions> options,
        PaymentSettingsRequest request)
    {
        try
        {
            var settings = await mediator.Send(new SavePaymentSettingsCommand(
                request.Currency, request.SecretKey, request.PublicKey, request.HmacSecret,
                request.CardIntegrationId, request.WalletIntegrationId, request.ApplePayIntegrationId,
                request.FeeMode, request.FeePercent, request.FeeFixed,
                request.AllowItems, request.AllowEqual, request.AllowCustom));
            return TypedResults.Ok(PaymentSettingsView.From(settings, sealer.CanSeal, CallbackUrl(options.Value), providers.IsSimulated(settings)));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    /// <summary>
    /// Paymob's transaction callback. Verified with the café's HMAC secret or
    /// ignored; a verified one marks the payment, and a bill it completes
    /// settles itself. Always 200 once verified, so the provider stops
    /// retrying; a bad signature is 401 and changes nothing.
    /// </summary>
    public static async Task<Results<Ok, UnauthorizedHttpResult, BadRequest>> Callback(
        HttpContext http,
        [FromServices] IOnlinePaymentRepository payments,
        [FromServices] PaymobProvider provider,
        [FromServices] SecretSealer sealer,
        [FromServices] IMediator mediator,
        [FromServices] ILoggerFactory loggers,
        [Description("Paymob's signature of the transaction")] string? hmac)
    {
        var logger = loggers.CreateLogger("Ninja.Sales.API.Payments.Callback");
        JsonElement body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<JsonElement>(http.Request.Body);
        }
        catch (JsonException)
        {
            return TypedResults.BadRequest();
        }
        // Only transactions move a payment; Paymob also sends token and other callbacks
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("type", out var type) || type.GetString() != "TRANSACTION")
            return TypedResults.Ok();

        var settings = await payments.GetSettingsAsync();
        if (settings.SealedSecretKey is null) return TypedResults.Unauthorized();
        var outcome = provider.VerifyCallback(PayRules.Account(settings, sealer), body, hmac);
        if (outcome is null)
        {
            logger.LogWarning("A {Provider} callback failed its signature check; ignored", provider.Name);
            return TypedResults.Unauthorized();
        }

        var confirmed = await mediator.Send(new ConfirmOnlinePaymentCommand(outcome, provider.Name));
        if (confirmed is { Paid: true })
        {
            try
            {
                await mediator.Send(new SettlePaidOnlineCommand(confirmed.TicketId));
            }
            catch (SalesDomainException ex)
            {
                // Paid is paid; the till settles what could not settle itself
                logger.LogWarning(ex, "Ticket {TicketId} is paid online but did not settle itself", confirmed.TicketId);
            }
        }
        return TypedResults.Ok();
    }

    private static string CallbackUrl(PaymentsOptions options) => $"{options.CallbackBaseUrl?.TrimEnd('/')}{CallbackPath}";

    private static (string? UserId, string? GuestId) Caller(HttpContext http)
    {
        var userId = http.User.GetUserId();
        return (userId, userId is null ? http.GetGuestId() : null);
    }

    /// <summary>On the bill: ordered on it, sat in its room, or already paid a share of it.</summary>
    private static async Task<bool> OnBillAsync(Ticket ticket, IOnlinePaymentRepository payments, string? userId, string? guestId)
    {
        if (userId is not null && ticket.Involves(userId)) return true;
        if (guestId is not null && ticket.Lines.Any(l => l.GuestId == guestId)) return true;
        var payer = userId ?? guestId;
        return (await payments.ListForTicketAsync(ticket.Id)).Any(p => p.PayerId == payer);
    }
}

/// <summary>Reads a bill for paying: its pricing, its online payments, the café's settings and switch.</summary>
public sealed class PayReader(
    ITicketRepository tickets,
    IOnlinePaymentRepository payments,
    ITenantFeaturesQueries features,
    PaymentProviders providers,
    TimeProvider clock)
{
    public async Task<PayView> ReadAsync(Ticket ticket, HttpContext http)
    {
        var bill = ticket.GetBill(await tickets.GetPricingRulesAsync(ticket.BranchId));
        var list = await payments.ListForTicketAsync(ticket.Id);
        var settings = await payments.GetSettingsAsync();
        var userId = http.User.GetUserId();
        return PayViews.Build(ticket, bill, list, settings, await features.OnlinePaymentsAsync(), userId, userId is null ? http.GetGuestId() : null, clock.GetUtcNow().UtcDateTime, providers.IsSimulated(settings));
    }
}
