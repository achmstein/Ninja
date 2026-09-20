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

    public static Ok<MailStatusResponse> GetMail(IMailer mailer, MailStatus status, IOptions<PlatformOptions> options)
    {
        var mail = options.Value.Mail;
        return TypedResults.Ok(new MailStatusResponse(mailer.Configured, mail.Host, mail.From, mail.OpsTo, status.LastSentAt, status.LastError, status.Sent, status.Failed, status.Skipped));
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> ResendWelcome(ControlContext context, MailQueue queue, IMailer mailer, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (!mailer.Configured) return TypedResults.Conflict<ProblemDetails>(new() { Detail = "Mail is not configured on this platform." });
        if (tenant.Status != TenantStatus.Running) return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is {tenant.Status}; the welcome names an admin app that is up." });
        queue.Enqueue(MailTemplates.Welcome(tenant, TenantHosts.For(tenant, options.Value), options.Value.Mail));
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

public record MailStatusResponse(bool Configured, string? Host, string From, string? OpsTo, DateTimeOffset? LastSentAt, string? LastError, int Sent, int Failed, int Skipped);
