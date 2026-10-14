using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The Google Maps tab's settings as the rest of the plane reads them: the
/// stamp, the app build's record and the tenant page each load the one row
/// afresh, so a key saved there is what the next stamp writes.
/// </summary>
public static class MapsStore
{
    /// <summary>The saved settings, or empty ones (no keys, the free maps) before anything was saved.</summary>
    public static async Task<MapsSettings> LoadAsync(ControlContext context, CancellationToken ct)
        => await context.MapsSettings.AsNoTracking().SingleOrDefaultAsync(m => m.Id == MapsSettings.SingletonId, ct) ?? new MapsSettings();

    /// <summary>
    /// The businesses whose stack the change reaches: Google Maps on, a stack on the box, and stamped
    /// differently after than before (a new server key reaches them all; a referrer only the one whose
    /// own domain it names). The app keys are not among what a stack is stamped with.
    /// </summary>
    public static IReadOnlyList<Tenant> ToRestamp(IEnumerable<Tenant> tenants, MapsSettings before, MapsSettings after, PlatformOptions platform)
        => tenants
            .Where(t => t.GoogleMaps && t.Status is not (TenantStatus.Requested or TenantStatus.Destroying or TenantStatus.Destroyed))
            .Where(t => before.StampFor(t, platform) != after.StampFor(t, platform))
            .ToList();

    /// <summary>
    /// A maps job for each business the change reaches, on the stamp lane like the record's switch: the request
    /// only queues them. A stack mid-stamp gets its job after, so it ends on the new keys whatever it wrote first.
    /// </summary>
    public static async Task<IReadOnlyList<string>> RestampAsync(
        ControlContext context, ProvisioningQueue queue, MapsSettings before, MapsSettings after, PlatformOptions platform, CancellationToken ct)
    {
        var on = await context.Tenants.AsNoTracking().Where(t => t.GoogleMaps).ToListAsync(ct);
        var due = ToRestamp(on, before, after, platform);
        foreach (var tenant in due)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "maps"), ct);
        return due.Select(t => t.Slug).ToList();
    }
}

/// <param name="Suggestions">How many places Google suggested.</param>
/// <param name="First">The first suggestion, as the apps' list would show it.</param>
/// <param name="Error">Google's own words when it refused (the key restricted to another address, the API not enabled, the quota spent).</param>
public sealed record MapsTestResult(bool Ok, int Milliseconds, int Suggestions, string? First, string? Error);

/// <summary>
/// One address search through the saved server key, the call the stacks make
/// (Places API (New) autocomplete, kept to Egypt), straight to Google and never
/// cached: whether the key answers from this box and how fast. A key restricted
/// to the box's address passes here as it would from a stack on the same box.
/// </summary>
public static class MapsSearchTest
{
    /// <summary>The http client the test calls Google with.</summary>
    public const string ClientName = "google-maps";

    public const string AutocompleteUrl = "https://places.googleapis.com/v1/places:autocomplete";

    public const string Query = "Tahrir";

    public static async Task<MapsTestResult> RunAsync(HttpClient http, string? serverKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(serverKey))
            return new(false, 0, 0, null, "No server key is saved yet.");

        using var request = new HttpRequestMessage(HttpMethod.Post, AutocompleteUrl)
        {
            Content = JsonContent.Create(new { input = Query, includedRegionCodes = new[] { "eg" }, languageCode = "en", regionCode = "eg" }),
        };
        request.Headers.Add("X-Goog-Api-Key", serverKey);
        request.Headers.Add("X-Goog-FieldMask", "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat");

        var clock = Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            using var response = await http.SendAsync(request, timeout.Token);
            var body = await response.Content.ReadAsStringAsync(timeout.Token);
            var ms = (int)clock.ElapsedMilliseconds;
            JsonNode? json = null;
            try { json = JsonNode.Parse(body); }
            catch (System.Text.Json.JsonException) { }

            if (!response.IsSuccessStatusCode)
            {
                // Google's shape: { error: { code, message, status } }
                var error = json?["error"];
                var status = error?["status"]?.GetValue<string>();
                var message = error?["message"]?.GetValue<string>() ?? body;
                return new(false, ms, 0, null, Trim($"{(int)response.StatusCode}{(status is null ? "" : $" {status}")}: {message}"));
            }

            var suggestions = json?["suggestions"] as JsonArray ?? [];
            var first = suggestions.FirstOrDefault()?["placePrediction"]?["structuredFormat"];
            var main = first?["mainText"]?["text"]?.GetValue<string>();
            var secondary = first?["secondaryText"]?["text"]?.GetValue<string>();
            return new(true, ms, suggestions.Count, main is null ? null : secondary is null ? main : $"{main}, {secondary}", null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return new(false, (int)clock.ElapsedMilliseconds, 0, null, Trim($"Google could not be reached: {ex.Message}"));
        }
    }

    private static string Trim(string text) => text.Length <= 300 ? text.Trim() : text[..300].Trim() + "…";
}
