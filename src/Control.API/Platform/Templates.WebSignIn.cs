namespace Ninja.Control.API.Platform;

/// <summary>
/// A web app's sign-in as the realm templates declare it, for a realm made
/// before: the one address Keycloak may send its code back to (not anything
/// under the app's host), where it may return after signing out, and how long
/// a sign-in on it lasts at most.
/// </summary>
/// <param name="ClientId">The app's client in the realm</param>
/// <param name="Url">The app's origin, as the realm's old wildcard named it</param>
/// <param name="PostLogout">Where the app lands after signing out</param>
/// <param name="Limited">Whether the client's own session limits apply (the staff and customer apps; the platform's control app keeps its realm's)</param>
public sealed record WebSignInClient(string ClientId, string Url, string PostLogout, bool Limited = true)
{
    /// <summary>The app's sign-in callback, its only redirect</summary>
    public string Callback => $"{Url}/auth/callback";

    /// <summary>The redirect the realm template gave before: anything under the app's host</summary>
    public string Wildcard => $"{Url}/*";
}

public static partial class Templates
{
    /// <summary>
    /// An access token lasts five minutes (it was two hours): one that leaks
    /// is soon worthless, and the apps renew theirs before it runs out.
    /// </summary>
    public const int AccessTokenSeconds = 5 * 60;

    /// <summary>A web sign-in not used for two weeks ends</summary>
    public const int WebClientIdleSeconds = 14 * 24 * 60 * 60;

    /// <summary>A web sign-in ends after thirty days however much it is used (the realm's own sessions run to ninety)</summary>
    public const int WebClientMaxSeconds = 30 * 24 * 60 * 60;

    /// <summary>The business's four web apps, as tenant-realm.json declares them</summary>
    public static IReadOnlyList<WebSignInClient> WebSignInClients(TenantHosts hosts) =>
    [
        new("admin-panel", hosts.AdminUrl, $"{hosts.AdminUrl}/signed-out"),
        // The customer app signs out to its home page
        new("client-web", hosts.CustomerUrl, hosts.CustomerUrl),
        new("pos-web", hosts.PosUrl, $"{hosts.PosUrl}/signed-out"),
        new("kds-web", hosts.KdsUrl, $"{hosts.KdsUrl}/signed-out"),
    ];

    /// <summary>The control app, as platform-realm.json declares it</summary>
    public static WebSignInClient ControlSignInClient(string controlUrl)
    {
        var url = controlUrl.TrimEnd('/');
        return new("control-web", url, $"{url}/signed-out", Limited: false);
    }
}
