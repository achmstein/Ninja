using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

public sealed record SocialLinkRequest(string Realm, string AccessToken);

/// <summary>
/// The customer app signs in with Google natively and trades Google's token for the business's own
/// (Keycloak's token exchange). Keycloak makes a new account for it, or takes the one already linked to
/// that Google account, but refuses an email some unlinked account has: one made with a password, moved
/// in from before, or signed in on the web through the hub (linked to the hub, not to Google). The app,
/// told "User already exists", hands the token here: Google says whose it is (verified email, and that
/// it was given to one of the platform's own sign-in clients), that email's account in the realm is
/// linked to the Google account, and the app trades the token again. Served on the auth host.
/// </summary>
public static partial class ControlApi
{
    public const string GoogleTokenInfoClient = "google-tokeninfo";

    private static void MapSocialLinkApi(RouteGroupBuilder api)
    {
        api.MapPost("/social/google/link", LinkGoogle).AllowAnonymous().ExcludeFromDescription().RequireRateLimiting(Extensions.Extensions.AnonymousRateLimit);
    }

    public static async Task<Results<Ok<JsonObject>, BadRequest, UnauthorizedHttpResult, NotFound>> LinkGoogle(
        SocialLinkRequest request, ControlContext context, IKeycloakAdmin keycloak, IHttpClientFactory clients, IOptions<PlatformOptions> options, ILoggerFactory loggers, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Realm) || string.IsNullOrWhiteSpace(request.AccessToken)) return TypedResults.BadRequest();
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == request.Realm, ct);
        if (tenant is null || !tenant.SocialSignIn) return TypedResults.NotFound();
        if (GoogleSignIn.Project(options.Value.Social.Google.ClientId) is not { } project) return TypedResults.NotFound();

        // Google says whose token it is; one given to another project's app is not taken
        using var answer = await clients.CreateClient(GoogleTokenInfoClient)
            .GetAsync($"https://oauth2.googleapis.com/tokeninfo?access_token={Uri.EscapeDataString(request.AccessToken)}", ct);
        if (!answer.IsSuccessStatusCode) return TypedResults.Unauthorized();
        var info = await answer.Content.ReadFromJsonAsync<JsonObject>(ct);
        var given = info?["azp"]?.GetValue<string>() ?? info?["aud"]?.GetValue<string>();
        var subject = info?["sub"]?.GetValue<string>();
        var email = info?["email"]?.GetValue<string>();
        var verified = info?["email_verified"]?.ToString() is "true" or "True";
        if (GoogleSignIn.Project(given) != project || subject is null || email is null || !verified) return TypedResults.Unauthorized();

        var done = await keycloak.LinkSocialAsync(TenantNaming.Realm(tenant.Slug), email, "google", subject, ct);
        loggers.CreateLogger("SocialLink").LogInformation("Google link for {Realm}: {Done}", tenant.Slug, done);
        return TypedResults.Ok(new JsonObject { ["link"] = done });
    }
}
