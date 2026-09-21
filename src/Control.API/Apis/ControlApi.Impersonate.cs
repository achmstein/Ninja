using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>
/// "Sign in as the owner": the master admin may open a session as any user
/// in any realm. The session's cookies belong to the auth host, so the
/// control app gets a one-time link on that host; opening it sets the
/// cookies and lands on the café's admin app, signed in as the owner.
/// </summary>
public static partial class ControlApi
{
    private static void MapImpersonationApi(RouteGroupBuilder api)
    {
        api.MapPost("/tenants/{slug}/impersonate", Impersonate).WithName("ImpersonateOwner").WithSummary("A one-time link that opens the café's admin app signed in as its owner").RequireAuthorization("Platform");
        api.MapGet("/impersonate/{ticket}", RedeemImpersonation).WithName("RedeemImpersonation").WithSummary("Opened on the auth host: sets the owner's session and goes to the admin app").AllowAnonymous().RequireRateLimiting(Extensions.Extensions.AnonymousRateLimit);
    }

    public static async Task<Results<Ok<ImpersonationLink>, NotFound, Conflict<ProblemDetails>, ProblemHttpResult>> Impersonate(
        ControlContext context, IKeycloakAdmin keycloak, ImpersonationTickets tickets, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{slug} is {tenant.Status}; there is nothing to sign in to." });

        var realm = TenantNaming.Realm(slug);
        var userId = await keycloak.FindUserIdAsync(realm, tenant.OwnerEmail, ct);
        if (userId is null)
            return TypedResults.Problem(detail: $"{tenant.OwnerEmail} is not in the {realm} realm.", statusCode: StatusCodes.Status409Conflict);

        var authHost = new Uri(options.Value.KeycloakPublicUrl).Host;
        IReadOnlyList<string> cookies;
        try
        {
            cookies = await keycloak.ImpersonateAsync(realm, userId, authHost, ct);
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
        if (cookies.Count == 0)
            return TypedResults.Problem(detail: "Keycloak opened the session but handed back no cookies.", statusCode: StatusCodes.Status502BadGateway);

        var hosts = TenantHosts.For(tenant, options.Value);
        var ticket = tickets.Issue(slug, cookies, hosts.AdminUrl);
        await audit.WriteAsync("owner.impersonated", slug, new { tenant.OwnerEmail }, ct);
        var origin = new Uri(options.Value.KeycloakPublicUrl).GetLeftPart(UriPartial.Authority);
        return TypedResults.Ok(new ImpersonationLink($"{origin}/api/control/impersonate/{ticket}", DateTimeOffset.UtcNow + ImpersonationTickets.Lifetime));
    }

    public static Results<RedirectHttpResult, NotFound<string>> RedeemImpersonation(HttpContext http, ImpersonationTickets tickets, string ticket)
    {
        var found = tickets.Redeem(ticket);
        if (found is null) return TypedResults.NotFound("This link was already used or has expired. Ask the control panel for a new one.");
        foreach (var cookie in found.SetCookies)
            http.Response.Headers.Append("Set-Cookie", cookie);
        http.Response.Headers.CacheControl = "no-store";
        return TypedResults.Redirect(found.RedirectUrl);
    }
}

/// <param name="Url">Open it in a new tab within the minute; it works once.</param>
public record ImpersonationLink(string Url, DateTimeOffset ExpiresAt);
