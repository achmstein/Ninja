using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.ServiceDefaults;

namespace Ninja.Control.API.Apis;

/// <summary>What a café pays for: its plan and add-ons, the payments recorded against it, and the suspension that follows a period nobody renewed.</summary>
public static partial class ControlApi
{
    private static void MapSubscriptionApi(RouteGroupBuilder api)
    {
        api.MapGet("/platform/plans", GetPlans).WithName("GetPlans").WithSummary("The plans, what each includes and what can be added on top").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/subscription", GetSubscription).WithName("GetTenantSubscription").WithSummary("Plan, add-ons, what they entitle, where the subscription stands, and the payments recorded").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/subscription", UpdateSubscription).WithName("UpdateTenantSubscription").WithSummary("A new plan or add-ons; the stack's gateway and switches follow").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/subscription/payments", RecordPayment).WithName("RecordTenantPayment").WithSummary("A payment received: extends what is paid through, and brings a suspended stack back").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/subscription/suspend", Suspend).WithName("SuspendTenant").WithSummary("Stop the stack for non-payment; the owner is told").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/subscription/resume", Resume).WithName("ResumeTenant").WithSummary("Bring a suspended stack back without a payment (the sweep may suspend it again while it stays unpaid)").RequireAuthorization("Platform");
    }

    public static Ok<PlanCatalogResponse> GetPlans()
        => TypedResults.Ok(new PlanCatalogResponse(
            Enum.GetValues<Module>(),
            Enum.GetValues<TenantPlan>().Select(p => new PlanDto(p, PlanCatalog.Included(p).OrderBy(m => m).ToArray(), PlanCatalog.AddonsAvailable(p).OrderBy(m => m).ToArray())).ToList()));

    public static async Task<Results<Ok<SubscriptionDetail>, NotFound>> GetSubscription(ControlContext context, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().Include(t => t.Payments).SingleOrDefaultAsync(t => t.Slug == slug, ct);
        return tenant is null ? TypedResults.NotFound() : TypedResults.Ok(SubscriptionDetail.From(tenant, options.Value));
    }

    public static async Task<Results<Ok<SubscriptionDetail>, NotFound, BadRequest<ProblemDetails>>> UpdateSubscription(
        ControlContext context, SubscriptionService subscriptions, IOptions<PlatformOptions> options, string slug, UpdateSubscriptionRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.Include(t => t.Payments).SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (request.GraceDays is < 0 or > 90)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Grace days must be between 0 and 90." });
        await subscriptions.ApplyAsync(tenant, request.Plan, request.Addons ?? [], request.GraceDays, ct);
        return TypedResults.Ok(SubscriptionDetail.From(tenant, options.Value));
    }

    public static async Task<Results<Created<SubscriptionDetail>, NotFound, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> RecordPayment(
        ControlContext context, SubscriptionService subscriptions, IOptions<PlatformOptions> options, HttpContext http, string slug, RecordPaymentRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.Include(t => t.Payments).SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Kind == TenantKind.Demo)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = "Convert the demo to a customer first." });
        if (request.Amount <= 0)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The amount must be more than zero." });
        var currency = request.Currency?.Trim().ToUpperInvariant() ?? "";
        if (!CurrencyCode().IsMatch(currency))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The currency must be an ISO 4217 code." });
        if (request.PeriodStart is { } start && request.PeriodEnd <= start)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The period must end after it starts." });

        var recordedBy = http.User.GetUserId() ?? "platform";
        await subscriptions.RecordPaymentAsync(tenant, request.Amount, currency, request.PeriodEnd, request.PeriodStart, Clean(request.Reference), Clean(request.Note), recordedBy, ct);
        return TypedResults.Created($"/api/control/tenants/{slug}/subscription", SubscriptionDetail.From(tenant, options.Value));
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Suspend(ControlContext context, SubscriptionService subscriptions, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status is not (TenantStatus.Running or TenantStatus.Stopped))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Cannot suspend a tenant that is {tenant.Status}." });
        await subscriptions.SuspendAsync(tenant, "manual", ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> Resume(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Suspended)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Cannot resume a tenant that is {tenant.Status}." });
        // Back by hand, still unpaid: Active until the sweep looks again
        if (tenant.Subscription == SubscriptionStatus.Suspended) tenant.Subscription = SubscriptionStatus.Active;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.resume", slug, new { reason = "manual" }, ct);
        await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "resume"), ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    [System.Text.RegularExpressions.GeneratedRegex("^[A-Z]{3}$")]
    private static partial System.Text.RegularExpressions.Regex CurrencyCode();
}

public record PlanDto(TenantPlan Plan, Module[] Included, Module[] Addons);

public record PlanCatalogResponse(Module[] Modules, IReadOnlyList<PlanDto> Plans);

public record PaymentDto(long Id, DateTimeOffset At, decimal Amount, string Currency, DateTimeOffset PeriodStart, DateTimeOffset PeriodEnd, string? Reference, string? Note, string RecordedBy)
{
    public static PaymentDto From(Payment p) => new(p.Id, p.At, p.Amount, p.Currency, p.PeriodStart, p.PeriodEnd, p.Reference, p.Note, p.RecordedBy);
}

/// <param name="Entitlements">What the plan and add-ons allow on the stack (everything for a demo).</param>
public record SubscriptionDetail(
    TenantPlan Plan,
    Module[] Addons,
    Module[] Included,
    Module[] AddonsAvailable,
    Module[] Entitlements,
    SubscriptionStatus Status,
    DateTimeOffset? PaidThrough,
    int GraceDays,
    DateTimeOffset? SuspendedAt,
    DateTimeOffset? PastDueNotifiedAt,
    IReadOnlyList<PaymentDto> Payments)
{
    public static SubscriptionDetail From(Tenant t, PlatformOptions p) => new(
        t.Plan,
        t.Addons,
        PlanCatalog.Included(t.Plan).OrderBy(m => m).ToArray(),
        PlanCatalog.AddonsAvailable(t.Plan).OrderBy(m => m).ToArray(),
        PlanCatalog.Entitlements(t).OrderBy(m => m).ToArray(),
        t.Subscription,
        t.PaidThrough,
        t.GraceDays ?? p.SubscriptionGraceDays,
        t.SuspendedAt,
        t.PastDueNotifiedAt,
        t.Payments.OrderByDescending(x => x.Id).Select(PaymentDto.From).ToList());
}

public record UpdateSubscriptionRequest(TenantPlan Plan, Module[]? Addons = null, [property: Description("0–90; null keeps the platform's default")] int? GraceDays = null);

public record RecordPaymentRequest(decimal Amount, string Currency, DateTimeOffset PeriodEnd, DateTimeOffset? PeriodStart = null, string? Reference = null, string? Note = null);
