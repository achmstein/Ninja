using Microsoft.AspNetCore.WebUtilities;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>
/// Apple's browser sign-in comes back as a form post: Apple refuses a query
/// answer once name or email is asked for (response_mode must be form_post),
/// and Keycloak's broker endpoint only listens for a GET. The auth host sends
/// Apple's post to the hub's endpoint here, and it goes on to the very same
/// address as a GET carrying the code and state, so the redirect URI Keycloak
/// gave Apple is still the one it trades the code on.
/// </summary>
public static partial class ControlApi
{
    private static void MapAppleApi(RouteGroupBuilder api)
    {
        api.MapPost("/social/apple", AppleFormPost).AllowAnonymous().DisableAntiforgery().ExcludeFromDescription().RequireRateLimiting(Extensions.Extensions.AnonymousRateLimit);
    }

    /// <summary>The hub's Apple endpoint, where Apple posts and Keycloak listens</summary>
    internal const string AppleBrokerPath = $"/realms/{TenantNaming.HubRealm}/broker/apple/endpoint";

    public static async Task<IResult> AppleFormPost(HttpContext http, CancellationToken ct)
    {
        if (!http.Request.HasFormContentType) return TypedResults.BadRequest();
        var form = await http.Request.ReadFormAsync(ct);
        return SeeOther(http, AppleBrokerUrl(form["state"], form["code"], form["error"]));
    }

    /// <summary>
    /// The broker's address with only what it reads. Apple's user field (the name, on a person's very
    /// first sign-in to the platform's Apple app, never again) cannot go on: Keycloak's OIDC broker
    /// reads a name only from the id_token, where Apple never puts it. A browser Apple account so
    /// arrives with no name, and the business's review-profile page and the apps' "complete your info"
    /// prompt ask for it
    /// </summary>
    internal static string AppleBrokerUrl(string? state, string? code, string? error)
    {
        var query = new Dictionary<string, string?> { ["state"] = state, ["code"] = code, ["error"] = error }
            .Where(p => !string.IsNullOrEmpty(p.Value));
        return QueryHelpers.AddQueryString(AppleBrokerPath, query);
    }

    /// <summary>A 303: the browser follows with a GET, to the host it posted to</summary>
    private static IResult SeeOther(HttpContext http, string location)
    {
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers.Location = location;
        return TypedResults.StatusCode(StatusCodes.Status303SeeOther);
    }
}
