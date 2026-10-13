using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;

namespace Ninja.Tenant.API.Services;

/// <summary>
/// The platform's Google Maps keys as this stack was stamped with them
/// (Maps__*). The server key never leaves this service; the browser key is
/// handed to the web apps only with the domains it works on.
/// </summary>
public sealed class MapsOptions
{
    public const string Section = "Maps";

    /// <summary>Places (New) only; empty leaves address search off and the apps on a typed address.</summary>
    public string? ServerKey { get; set; }

    /// <summary>Maps JavaScript only, set only while the platform has the web's Google map on.</summary>
    public string? BrowserKey { get; set; }

    /// <summary>The domains the browser key is restricted to, a comma list ("ninjapp.net,menu.blue.com"); a web app elsewhere keeps the free map.</summary>
    public string? WebDomains { get; set; }

    /// <summary>The most calls to Google this business makes in a minute and in a day, whoever asks; above them search answers nothing until the window turns.</summary>
    public int PerMinute { get; set; } = 120;

    public int PerDay { get; set; } = 3000;

    /// <summary>How long an answer is kept: the same street typed again, or the same place picked, costs nothing.</summary>
    public int CacheDays { get; set; } = 7;

    /// <summary>How far around the branch the suggestions lean; others still come, lower down.</summary>
    public double BiasRadiusMeters { get; set; } = 30_000;

    public bool Search => !string.IsNullOrWhiteSpace(ServerKey);
}

/// <summary>
/// The business's own ceiling on calls to Google: a minute's and a day's,
/// counted only for answers not already cached. Each address typed is a few
/// calls; a script hammering the endpoint from many addresses meets this
/// after the per-address limit has let it through.
/// </summary>
public sealed class PlacesQuota : IDisposable
{
    private readonly FixedWindowRateLimiter _minute;
    private readonly FixedWindowRateLimiter _day;

    public PlacesQuota(IOptions<MapsOptions> options)
    {
        _minute = new(new() { PermitLimit = Math.Max(1, options.Value.PerMinute), Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
        _day = new(new() { PermitLimit = Math.Max(1, options.Value.PerDay), Window = TimeSpan.FromDays(1), QueueLimit = 0 });
    }

    /// <summary>True when one more call to Google fits in both windows.</summary>
    public bool TryTake()
    {
        using var minute = _minute.AttemptAcquire();
        if (!minute.IsAcquired) return false;
        using var day = _day.AttemptAcquire();
        return day.IsAcquired;
    }

    public void Dispose()
    {
        _minute.Dispose();
        _day.Dispose();
    }
}

/// <summary>One suggestion as the customer reads it: the street or place, and the area under it.</summary>
public record PlaceSuggestion(string PlaceId, string PrimaryText, string? SecondaryText);

/// <summary>Where a picked suggestion is, and the address Google writes for it.</summary>
public record PlaceLocation(double Lat, double Lng, string? Address);

/// <summary>
/// Address search through Google's Places API (New), priced as low as it
/// goes. Autocomplete carries the customer's session token, so the keystrokes
/// of one search are free once it ends in the details of the place picked;
/// the details ask for the id, the point and the address only, Places'
/// cheapest fields. Suggestions are kept to the business's country and lean
/// toward the branch, and every answer is cached for a week by what was
/// typed, where and in which language. Google failing (a quota hit, the key
/// refused) answers nothing, and the apps fall back to the address typed.
/// </summary>
public sealed partial class PlacesClient(
    HttpClient http,
    IDistributedCache cache,
    PlacesQuota quota,
    IOptions<MapsOptions> options,
    IConfiguration configuration,
    ILogger<PlacesClient> logger)
{
    /// <summary>The named client: see <see cref="PlacesClientExtensions.AddPlacesClient"/>.</summary>
    public const string BaseUrl = "https://places.googleapis.com/v1/";

    /// <summary>The fewest letters searched for: one or two match half the country, and each would be a billed call.</summary>
    public const int MinLength = 3;

    /// <summary>What a place's details ask for: the cheapest of Places' tiers bills by the dearest field asked.</summary>
    public const string DetailsFieldMask = "id,location,formattedAddress";

    /// <summary>What an autocomplete answer is cut to: only the parts the list shows.</summary>
    public const string AutocompleteFieldMask = "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>The business's country, which Google keeps suggestions to: "eg".</summary>
    public string Region => (configuration["Tenant:Country"] is { Length: 2 } c ? c : "EG").ToLowerInvariant();

    public async Task<IReadOnlyList<PlaceSuggestion>> AutocompleteAsync(string? query, string? session, GeoPoint? near, string language, CancellationToken ct)
    {
        var q = Normalize(query);
        if (!options.Value.Search || q.Length < MinLength) return [];
        language = Language(language);
        // Near the same street (two decimals: about a kilometre), the same answers
        var area = near is { } p ? string.Create(CultureInfo.InvariantCulture, $"{p.Latitude:0.00},{p.Longitude:0.00}") : "-";
        var key = $"places:ac:{Region}:{language}:{area}:{q}";
        if (await ReadAsync<List<PlaceSuggestion>>(key, ct) is { } cached) return cached;
        if (!quota.TryTake())
        {
            logger.LogWarning("Address search is over the business's quota; answering nothing until the window turns");
            return [];
        }

        var body = new Dictionary<string, object?>
        {
            ["input"] = q,
            ["includedRegionCodes"] = new[] { Region },
            ["languageCode"] = language,
            ["regionCode"] = Region,
        };
        if (SessionToken(session) is { } token) body["sessionToken"] = token;
        if (near is { } at)
            body["locationBias"] = new { circle = new { center = new { latitude = at.Latitude, longitude = at.Longitude }, radius = options.Value.BiasRadiusMeters } };

        // "./": a bare "places:autocomplete" would read as a URI of scheme "places"
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri("./places:autocomplete", UriKind.Relative)) { Content = JsonContent.Create(body, options: Json) };
        request.Headers.Add("X-Goog-Api-Key", options.Value.ServerKey);
        request.Headers.Add("X-Goog-FieldMask", AutocompleteFieldMask);
        var answer = await SendAsync<AutocompleteAnswer>(request, ct);
        if (answer is null) return [];

        var suggestions = (answer.Suggestions ?? [])
            .Select(s => s.PlacePrediction)
            .Where(p => p is { PlaceId.Length: > 0 } && p.StructuredFormat?.MainText?.Text is { Length: > 0 })
            .Select(p => new PlaceSuggestion(p!.PlaceId!, p.StructuredFormat!.MainText!.Text!, p.StructuredFormat.SecondaryText?.Text))
            .ToList();
        await WriteAsync(key, suggestions, ct);
        return suggestions;
    }

    public async Task<PlaceLocation?> DetailsAsync(string placeId, string? session, string language, CancellationToken ct)
    {
        if (!options.Value.Search || !PlaceIdPattern().IsMatch(placeId)) return null;
        language = Language(language);
        var key = $"places:pl:{language}:{placeId}";
        if (await ReadAsync<PlaceLocation>(key, ct) is { } cached) return cached;
        if (!quota.TryTake())
        {
            logger.LogWarning("Address search is over the business's quota; answering nothing until the window turns");
            return null;
        }

        var url = $"places/{Uri.EscapeDataString(placeId)}?languageCode={language}&regionCode={Region}";
        // The token closes the session its autocompletes opened: they are billed as this one call
        if (SessionToken(session) is { } token) url += $"&sessionToken={token}";
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-Goog-Api-Key", options.Value.ServerKey);
        request.Headers.Add("X-Goog-FieldMask", DetailsFieldMask);
        var place = await SendAsync<PlaceAnswer>(request, ct);
        if (place?.Location is not { } point) return null;

        var location = new PlaceLocation(point.Latitude, point.Longitude, place.FormattedAddress);
        await WriteAsync(key, location, ct);
        return location;
    }

    /// <summary>What was typed, as one key: trimmed, single-spaced, lower case, at most a hundred letters.</summary>
    public static string Normalize(string? query)
    {
        if (string.IsNullOrWhiteSpace(query)) return "";
        var q = Spaces().Replace(query.Trim(), " ").ToLowerInvariant();
        return q.Length > 100 ? q[..100] : q;
    }

    /// <summary>The apps' token as Google takes it: URL-safe, 36 characters at most (a UUID); anything else is left out.</summary>
    public static string? SessionToken(string? session)
        => session is { Length: > 0 and <= 36 } s && SessionPattern().IsMatch(s) ? s : null;

    private static string Language(string language) => language.StartsWith("ar", StringComparison.OrdinalIgnoreCase) ? "ar" : "en";

    private async Task<T?> SendAsync<T>(HttpRequestMessage request, CancellationToken ct) where T : class
    {
        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                // A quota hit (429), a refused key (403): the apps fall back to the typed address
                logger.LogWarning("Places answered {Status} for {Path}", (int)response.StatusCode, request.RequestUri?.AbsolutePath);
                return null;
            }
            return await response.Content.ReadFromJsonAsync<T>(Json, ct);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(e, "Places could not be reached");
            return null;
        }
    }

    private async Task<T?> ReadAsync<T>(string key, CancellationToken ct) where T : class
    {
        var bytes = await cache.GetAsync(key, ct);
        return bytes is null ? null : JsonSerializer.Deserialize<T>(bytes, Json);
    }

    private Task WriteAsync<T>(string key, T value, CancellationToken ct)
        => cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(value, Json),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(Math.Max(1, options.Value.CacheDays)) }, ct);

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex SessionPattern();

    /// <summary>Google's place ids are URL-safe base64 and run to a few hundred characters.</summary>
    [GeneratedRegex("^[A-Za-z0-9_-]{10,512}$")]
    private static partial Regex PlaceIdPattern();

    private sealed record AutocompleteAnswer(List<Suggestion>? Suggestions);

    private sealed record Suggestion(Prediction? PlacePrediction);

    private sealed record Prediction(string? PlaceId, StructuredFormat? StructuredFormat);

    private sealed record StructuredFormat(FormattableText? MainText, FormattableText? SecondaryText);

    private sealed record FormattableText(string? Text);

    private sealed record PlaceAnswer(string? Id, string? FormattedAddress, LatLngAnswer? Location);

    private sealed record LatLngAnswer([property: JsonPropertyName("latitude")] double Latitude, [property: JsonPropertyName("longitude")] double Longitude);
}

public static class PlacesClientExtensions
{
    /// <summary>
    /// The Places client, its cache and the business's quota. The defaults'
    /// retries are taken off: a retried call to Google is a second bill, and a
    /// search that failed once is simply typed by hand.
    /// </summary>
    public static IServiceCollection AddPlacesClient(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MapsOptions>(configuration.GetSection(MapsOptions.Section));
        // In memory, sized: a week of one business's searches is a few megabytes
        services.AddDistributedMemoryCache(o => o.SizeLimit = 32 * 1024 * 1024);
        services.AddSingleton<PlacesQuota>();
        var builder = services.AddHttpClient<PlacesClient>(http =>
        {
            http.BaseAddress = new Uri(PlacesClient.BaseUrl);
            http.Timeout = TimeSpan.FromSeconds(5);
        });
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers: a retry to Google is billed again
        builder.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
        return services;
    }
}
