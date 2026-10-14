using System.Text.RegularExpressions;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Model;

/// <summary>
/// Google Maps, kept cheap: Ninja's one set of keys for every business, set on
/// the control panel's Google Maps tab (one row). Address search goes through
/// each stack's own server with the server key (Places, session priced,
/// cached), never from a browser; the phones draw Google's map with the native
/// SDK, which has no charge per load; the web draws it only when
/// <see cref="WebTiles"/> is on, with the browser key, and keeps the free
/// OpenFreeMap streets otherwise. The daily caps and the budget alert are set
/// on the keys in Google Cloud: above them a request fails and the apps fall
/// back, nothing is billed. The keys are encrypted at rest like the AI's.
/// </summary>
public partial class MapsSettings
{
    /// <summary>The one row there is.</summary>
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>Places (New) only, restricted to the box's address; handed to each stack's Tenant.API, never to an app.</summary>
    public string? ServerKey { get; set; }

    /// <summary>Maps JavaScript only, restricted to the referrers below; handed to the web apps when <see cref="WebTiles"/> is on.</summary>
    public string? BrowserKey { get; set; }

    /// <summary>Whether the web apps draw Google's map rather than OpenFreeMap's; off by default, since each load of the web map is billed.</summary>
    public bool WebTiles { get; set; }

    /// <summary>The Maps SDK keys the customer app is built with, restricted to the apps' ids (and Android's signing certificates).</summary>
    public string? AndroidKey { get; set; }

    public string? IosKey { get; set; }

    /// <summary>
    /// The businesses' own domains already on the browser key's referrer list
    /// (the platform's *.{Domain} is put there once, by hand). Google takes a
    /// key only from the sites it lists, so a domain not here stays on the free
    /// map until it is added there and here. A comma list of hosts, a leading
    /// "*." covering every name under one: "menu.blue.com,*.cove.eg".
    /// </summary>
    public string? ReferrerDomains { get; set; }

    public DateTime UpdatedAt { get; set; }

    public bool Search => !string.IsNullOrWhiteSpace(ServerKey);

    public bool Web => WebTiles && !string.IsNullOrWhiteSpace(BrowserKey);

    /// <summary>Whether the platform has any key at all; without one a business's switch does nothing.</summary>
    public bool Available => Search || Web || !string.IsNullOrWhiteSpace(AndroidKey) || !string.IsNullOrWhiteSpace(IosKey);

    /// <summary>Address search for this business: the platform has the key and the business has Google Maps on.</summary>
    public bool SearchFor(Tenant tenant) => tenant.GoogleMaps && Search;

    /// <summary>Google's map on this business's web apps: its switch, the key and the platform's web switch.</summary>
    public bool WebFor(Tenant tenant) => tenant.GoogleMaps && Web;

    /// <summary>A Maps SDK key for this business's app build; null keeps the free map in it.</summary>
    public string? AppKeyFor(Tenant tenant, string? key) => tenant.GoogleMaps && !string.IsNullOrWhiteSpace(key) ? key : null;

    public IReadOnlyList<string> Referrers
        => (ReferrerDomains ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    /// <summary>Whether the referrer list covers the host: named as it is, or under a "*." entry.</summary>
    public bool Covers(string host)
        => Referrers.Any(r => r.StartsWith("*.", StringComparison.Ordinal)
            ? host.EndsWith(r[1..], StringComparison.OrdinalIgnoreCase)
            : string.Equals(r, host, StringComparison.OrdinalIgnoreCase));

    /// <summary>The domains the browser key works on for this business: the platform's, and its own once listed.</summary>
    public IReadOnlyList<string> WebDomains(Tenant tenant, PlatformOptions platform)
        => !string.IsNullOrEmpty(tenant.CustomerDomain) && PendingDomain(tenant) is null ? [platform.Domain, tenant.CustomerDomain] : [platform.Domain];

    /// <summary>The business's own domain when its web map is on and the browser key does not list it yet; null when there is nothing to add.</summary>
    public string? PendingDomain(Tenant tenant)
        => WebFor(tenant) && !string.IsNullOrEmpty(tenant.CustomerDomain) && !Covers(tenant.CustomerDomain)
            ? tenant.CustomerDomain
            : null;

    /// <summary>
    /// What the business's stack is stamped with from these settings, as one string: the server key, the
    /// browser key and the domains it works on. Two settings that give a business the same string leave
    /// its stack as it is; the app keys are not here, since they reach only the next app build.
    /// </summary>
    public string StampFor(Tenant tenant, PlatformOptions platform)
        => string.Join('\n', SearchFor(tenant) ? ServerKey : "", WebFor(tenant) ? BrowserKey : "", WebFor(tenant) ? string.Join(',', WebDomains(tenant, platform)) : "");

    /// <summary>
    /// A referrer as Google Cloud shows it ("https://menu.blue.com/*") or as a bare host, put as the list
    /// keeps it: the host alone, lower case, a leading "*." kept. Null when it is no host at all.
    /// </summary>
    public static string? NormalizeReferrer(string? entry)
    {
        var host = (entry ?? "").Trim().ToLowerInvariant();
        var scheme = host.IndexOf("://", StringComparison.Ordinal);
        if (scheme >= 0) host = host[(scheme + 3)..];
        var slash = host.IndexOf('/');
        if (slash >= 0) host = host[..slash];
        host = host.TrimEnd('.');
        return host.Length <= 253 && HostPattern().IsMatch(host) ? host : null;
    }

    [GeneratedRegex(@"^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$")]
    private static partial Regex HostPattern();
}
