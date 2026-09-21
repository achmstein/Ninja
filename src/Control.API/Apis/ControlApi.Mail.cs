using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>What the platform sends by mail: whether it can, how it has gone, and the welcome sent again by hand.</summary>
public static partial class ControlApi
{
    private static void MapMailApi(RouteGroupBuilder api)
    {
        api.MapGet("/platform/mail", GetMail).WithName("GetPlatformMail").WithSummary("Whether mail is configured, when it last went out, what last went wrong").RequireAuthorization("Platform");
        api.MapPost("/platform/mail/realms", ApplyMailToRealms).WithName("ApplyMailToRealms").WithSummary("Give every realm the platform's SMTP settings, so password resets work in realms stamped before mail was set up").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/mail/welcome", ResendWelcome).WithName("ResendWelcomeEmail").WithSummary("The owner's welcome mail again: the admin app's address, their email and the temporary password if it still stands").RequireAuthorization("Platform");
    }

    public static async Task<Ok<MailStatusResponse>> GetMail(ControlContext context, IMailer mailer, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        var mail = options.Value.Mail;
        // The outbox is the record: what went, what did not, what is still waiting
        var counts = await context.Outbox.GroupBy(m => m.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        int Of(MailOutcome o) => counts.FirstOrDefault(c => c.Key == o)?.Count ?? 0;
        var lastSentAt = await context.Outbox.Where(m => m.Status == MailOutcome.Sent).MaxAsync(m => (DateTimeOffset?)m.SentAt, ct);
        var lastError = await context.Outbox.Where(m => m.Status == MailOutcome.Failed).OrderByDescending(m => m.Id).Select(m => m.LastError).FirstOrDefaultAsync(ct);
        return TypedResults.Ok(new MailStatusResponse(mailer.Configured, mail.Host, mail.From, mail.OpsTo, lastSentAt, lastError, Of(MailOutcome.Sent), Of(MailOutcome.Failed), Of(MailOutcome.Skipped), Of(MailOutcome.Queued)));
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> ResendWelcome(ControlContext context, IMailer mailer, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!mailer.Configured) return TypedResults.Conflict<ProblemDetails>(new() { Detail = "Mail is not configured on this platform." });
        if (tenant.Status != TenantStatus.Running) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is {tenant.Status}; the welcome names an admin app that is up." });
        context.Outbox.Add(OutboxMail.From(MailTemplates.Welcome(tenant, TenantHosts.For(tenant, options.Value), options.Value.Mail)));
        tenant.WelcomeSentAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("mail.welcome.resent", slug, new { to = tenant.OwnerEmail }, ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    public static async Task<Results<Ok<int>, Conflict<ProblemDetails>>> ApplyMailToRealms(ControlContext context, IKeycloakAdmin keycloak, IAuditWriter audit, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        if (!options.Value.Mail.Configured) return TypedResults.Conflict<ProblemDetails>(new() { Detail = "Mail is not configured on this platform." });
        var smtp = Templates.SmtpServerJson(options.Value.Mail);
        var slugs = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed).Select(t => t.Slug).ToListAsync(ct);
        await keycloak.SetRealmSmtpAsync("ninja", smtp, ct);
        foreach (var slug in slugs) await keycloak.SetRealmSmtpAsync(TenantNaming.Realm(slug), smtp, ct);
        await audit.WriteAsync("mail.realms.updated", null, new { realms = slugs.Count + 1 }, ct);
        return TypedResults.Ok(slugs.Count + 1);
    }
}

/// <param name="Queued">Waiting for the sender; more than a handful for long means the SMTP host is not answering.</param>
public record MailStatusResponse(bool Configured, string? Host, string From, string? OpsTo, DateTimeOffset? LastSentAt, string? LastError, int Sent, int Failed, int Skipped, int Queued);
