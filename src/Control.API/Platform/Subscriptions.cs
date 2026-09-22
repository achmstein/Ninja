using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The café's subscription on the platform: its plan and add-ons (which
/// become entitlements on the stack), what it has paid through, and the
/// suspension that follows a paid period nobody renewed. Billing is by hand
/// for now: a platform admin records each payment. A payment provider's
/// webhook would call <see cref="RecordPaymentAsync"/> and nothing else.
/// </summary>
public sealed class SubscriptionService(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, IOptions<PlatformOptions> options)
{
    private PlatformOptions Platform => options.Value;

    /// <summary>
    /// A new plan or add-ons: saved, and the stack told when there is one to
    /// tell. Told even when nothing changed: a stack that never heard its
    /// entitlements (stamped before plans, or by hand) keeps every switch
    /// usable until it does, and a save is how a platform admin sets that
    /// right without restarting it.
    /// </summary>
    public async Task ApplyAsync(Tenant tenant, TenantPlan plan, IEnumerable<Module> addons, int? graceDays, CancellationToken ct)
    {
        tenant.Plan = plan;
        tenant.Addons = PlanCatalog.NormalizeAddons(plan, addons);
        tenant.GraceDays = graceDays;
        await context.SaveChangesAsync(ct);
        var entitled = PlanCatalog.Entitlements(tenant);
        await audit.WriteAsync("subscription.changed", tenant.Slug, new { plan, addons = tenant.Addons.Select(PlanCatalog.Key), graceDays, entitled = entitled.Select(PlanCatalog.Key) }, ct);
        if (tenant.Status is TenantStatus.Running or TenantStatus.Stopped or TenantStatus.Suspended)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "entitlements"), ct);
    }

    /// <summary>The one place a payment lands: the period it covers extends what is paid through, and a suspended stack comes back.</summary>
    public async Task<Payment> RecordPaymentAsync(Tenant tenant, decimal amount, string currency, DateTimeOffset periodEnd, DateTimeOffset? periodStart, string? reference, string? note, string recordedBy, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var payment = new Payment
        {
            TenantId = tenant.Id,
            At = now,
            Amount = amount,
            Currency = currency,
            PeriodStart = periodStart ?? tenant.PaidThrough ?? now,
            PeriodEnd = periodEnd,
            Reference = reference,
            Note = note,
            RecordedBy = recordedBy,
        };
        context.Payments.Add(payment);
        tenant.PaidThrough = tenant.PaidThrough is { } paid && paid > periodEnd ? paid : periodEnd;
        tenant.Subscription = SubscriptionStatus.Active;
        tenant.PastDueNotifiedAt = null;
        context.Outbox.Add(OutboxMail.From(MailTemplates.PaymentReceived(tenant, amount, currency, periodEnd, reference, Platform.Mail)));
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("payment.recorded", tenant.Slug, new { amount, currency, periodEnd, reference }, ct);
        if (tenant.Status == TenantStatus.Suspended)
        {
            await audit.WriteAsync("tenant.resume", tenant.Slug, new { reason = "payment" }, ct);
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "resume"), ct);
        }
        return payment;
    }

    /// <summary>The stack stops for non-payment (or by hand); the owner hears.</summary>
    public async Task SuspendAsync(Tenant tenant, string reason, CancellationToken ct)
    {
        tenant.Subscription = SubscriptionStatus.Suspended;
        tenant.SuspendedAt ??= DateTimeOffset.UtcNow;
        context.Outbox.Add(OutboxMail.From(MailTemplates.SubscriptionSuspended(tenant, TenantHosts.For(tenant, Platform), Platform.Mail)));
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("subscription.suspended", tenant.Slug, new { reason }, ct);
        if (tenant.Status is TenantStatus.Running or TenantStatus.Stopped)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "suspend"), ct);
    }
}

public enum SweepDecision
{
    None,
    /// <summary>Past the paid period: tell the owner, keep running.</summary>
    PastDue,
    /// <summary>Past the grace too: stop the stack.</summary>
    Suspend,
}

/// <summary>What the daily sweep does with one customer; pure, for the test.</summary>
public static class SubscriptionSweep
{
    public static SweepDecision Decide(Tenant t, DateOnly today, int defaultGraceDays)
    {
        if (t.Kind != TenantKind.Customer || t.PaidThrough is not { } paidThrough) return SweepDecision.None;
        if (t.Subscription is SubscriptionStatus.Cancelled or SubscriptionStatus.Suspended) return SweepDecision.None;
        var paidDay = DateOnly.FromDateTime(paidThrough.UtcDateTime);
        var graceEnds = paidDay.AddDays(t.GraceDays ?? defaultGraceDays);
        if (today > graceEnds && t.Status is TenantStatus.Running or TenantStatus.Stopped) return SweepDecision.Suspend;
        if (today > paidDay && t.Subscription is SubscriptionStatus.Active or SubscriptionStatus.Trialing) return SweepDecision.PastDue;
        return SweepDecision.None;
    }
}

/// <summary>Once a day, platform time: customers past their paid period are told, and past their grace, suspended.</summary>
public sealed class SubscriptionSweepService(IServiceScopeFactory scopes, IOptions<PlatformOptions> options, ILogger<SubscriptionSweepService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var wait = NightlyBackupService.UntilNextRun(DateTimeOffset.UtcNow, options.Value.TimeZone, options.Value.SubscriptionSweepHour);
            logger.LogInformation("Next subscription sweep in {Wait}", wait);
            try
            {
                await Task.Delay(wait, stoppingToken);
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Subscription sweep failed");
            }
        }
    }

    internal async Task SweepAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var subscriptions = scope.ServiceProvider.GetRequiredService<SubscriptionService>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var platform = options.Value;

        // "Paid through the 30th" holds through the 30th where the platform is
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(platform.TimeZone); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { zone = TimeZoneInfo.Utc; }
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime);

        var customers = await context.Tenants
            .Where(t => t.Kind == TenantKind.Customer && t.PaidThrough != null)
            .Where(t => t.Status == TenantStatus.Running || t.Status == TenantStatus.Stopped)
            .ToListAsync(ct);

        foreach (var tenant in customers)
        {
            switch (SubscriptionSweep.Decide(tenant, today, platform.SubscriptionGraceDays))
            {
                case SweepDecision.PastDue:
                    tenant.Subscription = SubscriptionStatus.PastDue;
                    tenant.PastDueNotifiedAt = DateTimeOffset.UtcNow;
                    var graceEnds = tenant.PaidThrough!.Value.AddDays(tenant.GraceDays ?? platform.SubscriptionGraceDays);
                    context.Outbox.Add(OutboxMail.From(MailTemplates.SubscriptionPastDue(tenant, TenantHosts.For(tenant, platform), graceEnds, platform.Mail)));
                    await context.SaveChangesAsync(ct);
                    await audit.WriteAsync("subscription.past-due", tenant.Slug, new { tenant.PaidThrough }, ct, "sweep");
                    break;
                case SweepDecision.Suspend:
                    logger.LogInformation("{Slug} past its grace; suspending", tenant.Slug);
                    await subscriptions.SuspendAsync(tenant, "grace over", ct);
                    break;
            }
        }
    }
}
