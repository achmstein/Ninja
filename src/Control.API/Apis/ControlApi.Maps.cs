using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <param name="Set">Whether a key is saved.</param>
/// <param name="Hint">Its last four characters, the only part ever shown again; empty when none is saved.</param>
public sealed record MapsKeyDto(bool Set, string Hint);

public sealed record MapsSettingsDto(
    [property: Description("Places API (New) only, restricted to this box's IP: each stack's address search")] MapsKeyDto ServerKey,
    [property: Description("Maps JavaScript API only, restricted to the websites: the web apps' Google map, while web tiles are on")] MapsKeyDto BrowserKey,
    [property: Description("Maps SDK for Android, restricted to the apps' packages and signing SHA-1s: in the customer app's next build")] MapsKeyDto AndroidKey,
    [property: Description("Maps SDK for iOS, restricted to the apps' bundle IDs: in the customer app's next build")] MapsKeyDto IosKey,
    [property: Description("Whether the web apps draw Google's map (billed per load) rather than the free OpenFreeMap streets")] bool WebTiles,
    [property: Description("The businesses' own domains already on the browser key's referrers; a leading *. covers every name under one")] IReadOnlyList<string> ReferrerDomains,
    [property: Description("How many businesses have Google Maps switched on")] int BusinessesOn,
    DateTime? UpdatedAt);

/// <summary>A key left out or empty keeps the saved one; Clear… takes it off. Web tiles and referrers left out stay as they are.</summary>
public sealed record SaveMapsSettingsRequest(
    string? ServerKey = null,
    string? BrowserKey = null,
    string? AndroidKey = null,
    string? IosKey = null,
    bool ClearServerKey = false,
    bool ClearBrowserKey = false,
    bool ClearAndroidKey = false,
    bool ClearIosKey = false,
    bool? WebTiles = null,
    [property: Description("Hosts, or referrers as Google Cloud shows them (https://menu.blue.com/*); kept as hosts")] IReadOnlyList<string>? ReferrerDomains = null);

public sealed record SaveMapsSettingsResult(
    MapsSettingsDto Settings,
    [property: Description("The businesses being re-stamped with the new settings (a maps job each, on the queue)")] IReadOnlyList<string> Restamping,
    [property: Description("Whether the Android or iOS key changed: the phone apps take it at their next build")] bool AppKeysChanged);

public static partial class ControlApi
{
    private static void MapMapsApi(RouteGroupBuilder api)
    {
        api.MapGet("/maps", GetMaps).WithName("GetMapsSettings").WithSummary("The platform's Google Maps keys (shown by their last four characters), the web map switch and the referrer domains").RequireAuthorization("Platform");
        api.MapPut("/maps", SaveMaps).WithName("SaveMapsSettings").WithSummary("Change the Google Maps settings; a key left out keeps the saved one. The businesses with Google Maps on are re-stamped when their stacks would change").RequireAuthorization("Platform");
        api.MapPost("/maps/test", TestMaps).WithName("TestMapsSearch").WithSummary("One address search through the saved server key, straight to Google: whether it answers and how fast").RequireAuthorization("Platform");
    }

    private static MapsKeyDto KeyDto(string? key) => string.IsNullOrWhiteSpace(key) ? new(false, "") : new(true, key.Length >= 4 ? key[^4..] : "");

    private static async Task<MapsSettingsDto> MapsDtoAsync(ControlContext context, MapsSettings maps, CancellationToken ct)
        => new(KeyDto(maps.ServerKey), KeyDto(maps.BrowserKey), KeyDto(maps.AndroidKey), KeyDto(maps.IosKey), maps.WebTiles, maps.Referrers,
            await context.Tenants.CountAsync(t => t.GoogleMaps && t.Status != TenantStatus.Destroyed, ct),
            maps.UpdatedAt == default ? null : maps.UpdatedAt);

    public static async Task<Ok<MapsSettingsDto>> GetMaps(ControlContext context, CancellationToken ct)
        => TypedResults.Ok(await MapsDtoAsync(context, await MapsStore.LoadAsync(context, ct), ct));

    public static async Task<Results<Ok<SaveMapsSettingsResult>, BadRequest<ProblemDetails>>> SaveMaps(
        SaveMapsSettingsRequest request, ControlContext context, ProvisioningQueue queue, IAuditWriter audit, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        foreach (var (name, key, clear) in new[]
        {
            ("server", request.ServerKey, request.ClearServerKey),
            ("browser", request.BrowserKey, request.ClearBrowserKey),
            ("Android", request.AndroidKey, request.ClearAndroidKey),
            ("iOS", request.IosKey, request.ClearIosKey),
        })
        {
            if (string.IsNullOrWhiteSpace(key)) continue;
            if (clear)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"The {name} key: give a new one or clear it, not both." });
            if (key.Trim().Length > 200 || key.Trim().Any(char.IsWhiteSpace))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"The {name} key does not look like a Google API key (one word, like AIza…)." });
        }

        string? referrers = null;
        if (request.ReferrerDomains is { } entries)
        {
            var hosts = new List<string>();
            foreach (var entry in entries.Where(e => !string.IsNullOrWhiteSpace(e)))
            {
                if (MapsSettings.NormalizeReferrer(entry) is not { } host)
                    return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"\"{entry.Trim()}\" is not a domain: give a host like menu.blue.com, *.blue.com or https://menu.blue.com/*." });
                if (!hosts.Contains(host)) hosts.Add(host);
            }
            if (hosts.Count > 200)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "At most 200 referrer domains." });
            referrers = string.Join(',', hosts);
        }

        var before = await MapsStore.LoadAsync(context, ct);
        var maps = await context.MapsSettings.SingleOrDefaultAsync(m => m.Id == MapsSettings.SingletonId, ct);
        if (maps is null)
        {
            maps = new MapsSettings();
            context.MapsSettings.Add(maps);
        }

        // Never a key's value in the audit: only which changed and how
        var keys = new Dictionary<string, string>();
        maps.ServerKey = ApplyKey("serverKey", maps.ServerKey, request.ServerKey, request.ClearServerKey, keys);
        maps.BrowserKey = ApplyKey("browserKey", maps.BrowserKey, request.BrowserKey, request.ClearBrowserKey, keys);
        maps.AndroidKey = ApplyKey("androidKey", maps.AndroidKey, request.AndroidKey, request.ClearAndroidKey, keys);
        maps.IosKey = ApplyKey("iosKey", maps.IosKey, request.IosKey, request.ClearIosKey, keys);
        var webChanged = request.WebTiles is { } web && web != maps.WebTiles;
        if (webChanged) maps.WebTiles = request.WebTiles!.Value;
        var referrersChanged = referrers is not null && referrers != (maps.ReferrerDomains ?? "");
        if (referrersChanged) maps.ReferrerDomains = referrers!.Length == 0 ? null : referrers;

        if (keys.Count == 0 && !webChanged && !referrersChanged)
            return TypedResults.Ok(new SaveMapsSettingsResult(await MapsDtoAsync(context, maps, ct), [], false));

        maps.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        // The stacks that would be stamped differently are re-stamped in the background; the app keys wait for the next build
        var restamping = await MapsStore.RestampAsync(context, queue, before, maps, options.Value, ct);
        var appKeysChanged = keys.ContainsKey("androidKey") || keys.ContainsKey("iosKey");
        await audit.WriteAsync("maps.settings.saved", null, new
        {
            keys,
            webTiles = webChanged ? maps.WebTiles : (bool?)null,
            referrerDomains = referrersChanged ? maps.Referrers : null,
            restamping,
        }, ct);
        return TypedResults.Ok(new SaveMapsSettingsResult(await MapsDtoAsync(context, maps, ct), restamping, appKeysChanged));
    }

    /// <summary>The key after the request: a new one given replaces it, a clear takes it off, nothing keeps it. What happened goes into <paramref name="changes"/>.</summary>
    internal static string? ApplyKey(string name, string? saved, string? given, bool clear, Dictionary<string, string> changes)
    {
        if (!string.IsNullOrWhiteSpace(given))
        {
            var key = given.Trim();
            if (key != saved) changes[name] = saved is null ? "set" : "replaced";
            return key;
        }
        if (clear && saved is not null)
        {
            changes[name] = "cleared";
            return null;
        }
        return saved;
    }

    public static async Task<Ok<MapsTestResult>> TestMaps(ControlContext context, IHttpClientFactory clients, CancellationToken ct)
    {
        var maps = await MapsStore.LoadAsync(context, ct);
        return TypedResults.Ok(await MapsSearchTest.RunAsync(clients.CreateClient(MapsSearchTest.ClientName), maps.ServerKey, ct));
    }
}
