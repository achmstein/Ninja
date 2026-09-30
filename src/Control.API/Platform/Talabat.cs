using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Ninja.Control.API.Platform;

/// <summary>
/// Ninja's one account with Talabat (Delivery Hero's POS integration): the
/// middleware it calls, the credentials it logs in with, and the secret the
/// middleware signs its own calls with. They belong to Ninja, the integration
/// partner, not to a business — so they stay here, on the platform, and every
/// business's stack goes through the relay instead of holding them. Empty leaves
/// the integration off.
/// </summary>
public sealed class TalabatOptions
{
    /// <summary>The POS middleware's base URL, e.g. https://integration-middleware.me.restaurant-partners.com (staging: …stg…).</summary>
    public string? MiddlewareUrl { get; set; }

    public string? Username { get; set; }

    public string? Password { get; set; }

    /// <summary>What the middleware's JWTs are signed with (HS512); it differs between staging and production.</summary>
    public string? Secret { get; set; }

    /// <summary>Where the stacks reach the relay, on the shared network.</summary>
    public string RelayUrl { get; set; } = "http://control-api:8080";

    public bool Configured =>
        !string.IsNullOrWhiteSpace(MiddlewareUrl) && !string.IsNullOrWhiteSpace(Username)
        && !string.IsNullOrWhiteSpace(Password) && !string.IsNullOrWhiteSpace(Secret);
}

/// <summary>The names and keys the relay knows a business's branch by.</summary>
public static class TalabatNaming
{
    /// <summary>
    /// The remote id a branch is registered with at Talabat: the business's slug
    /// and the branch, "{slug}-{branchId}". Talabat routes every order by it,
    /// so it has to be unique across every business on the platform.
    /// </summary>
    public static string RemoteId(string slug, int branchId) => $"{slug}-{branchId.ToString(CultureInfo.InvariantCulture)}";

    /// <summary>The slug and branch back out of a remote id; false for one that is not ours.</summary>
    public static bool TryParseRemoteId(string? remoteId, out string slug, out int branchId)
    {
        slug = "";
        branchId = 0;
        if (string.IsNullOrWhiteSpace(remoteId)) return false;
        var dash = remoteId.LastIndexOf('-');
        if (dash <= 0 || !int.TryParse(remoteId.AsSpan(dash + 1), NumberStyles.None, CultureInfo.InvariantCulture, out branchId) || branchId <= 0)
            return false;
        slug = remoteId[..dash].ToLowerInvariant();
        return TenantNaming.IsValidSlug(slug);
    }

    /// <summary>
    /// A business's key to the relay: derived from the platform's encryption key
    /// and the slug, so it is stamped and checked without being stored, and
    /// one business's key opens nothing for another.
    /// </summary>
    public static string RelayKey(string slug, string platformKey)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes("talabat-relay:" + platformKey));
        return Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(slug)));
    }

    /// <summary>
    /// Talabat's market for a country when the operator gave none: Egypt is
    /// the old Otlob entity (HF_EG); the Gulf markets are TB_{country}.
    /// </summary>
    public static string DefaultGlobalEntity(string country)
        => string.Equals(country, "EG", StringComparison.OrdinalIgnoreCase) ? "HF_EG" : $"TB_{country.ToUpperInvariant()}";

    public static bool RelayKeyMatches(string slug, string platformKey, string? presented)
        => presented is not null && CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(RelayKey(slug, platformKey)), Encoding.ASCII.GetBytes(presented));
}

/// <summary>
/// Checks that a call claiming to come from Talabat's middleware does: a JWT
/// signed HS512 with the secret Talabat issued, carrying service=middleware.
/// </summary>
public static class TalabatJwt
{
    public static bool IsFromMiddleware(string? authorization, string secret)
    {
        if (authorization is null || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return false;
        var parts = authorization[7..].Trim().Split('.');
        if (parts.Length != 3) return false;

        try
        {
            var header = JsonNode.Parse(Base64Url(parts[0]));
            if (header?["alg"]?.GetValue<string>() is not "HS512") return false;

            var expected = HMACSHA512.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"));
            if (!CryptographicOperations.FixedTimeEquals(expected, Base64Url(parts[2])))
                return false;

            var payload = JsonNode.Parse(Base64Url(parts[1]));
            if (payload?["service"]?.GetValue<string>() != "middleware") return false;
            // An expiry, when the token has one, is honoured
            if (payload["exp"] is JsonValue exp && exp.TryGetValue<long>(out var seconds) && DateTimeOffset.FromUnixTimeSeconds(seconds) < DateTimeOffset.UtcNow.AddMinutes(-1))
                return false;
            return true;
        }
        catch (Exception ex) when (ex is FormatException or JsonException or InvalidOperationException)
        {
            return false;
        }
    }

    private static byte[] Base64Url(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
        return Convert.FromBase64String(padded);
    }
}

/// <summary>The middleware's answer to a status update, passed back to the stack as it came.</summary>
public sealed record TalabatCallResult(int Status, string Body);

/// <summary>
/// Calls Talabat's middleware as Ninja: logs in (the token lives half an
/// hour; kept until shortly before) and posts a status change to the address
/// the order named for it — only ever an address on the middleware itself, so
/// no business can have the platform send its token anywhere else.
/// </summary>
public sealed class TalabatMiddleware(IHttpClientFactory http, IOptions<PlatformOptions> options, ILogger<TalabatMiddleware> logger)
{
    public const string HttpClientName = "talabat";

    private readonly SemaphoreSlim _login = new(1, 1);
    private (string Token, DateTimeOffset ExpiresAt)? _token;

    private TalabatOptions Talabat => options.Value.Talabat;

    /// <summary>Whether the address belongs to the middleware Ninja is registered with.</summary>
    public bool IsMiddlewareUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var target)
            && Uri.TryCreate(Talabat.MiddlewareUrl, UriKind.Absolute, out var middleware)
            && target.Scheme == Uri.UriSchemeHttps
            && string.Equals(target.Host, middleware.Host, StringComparison.OrdinalIgnoreCase);

    public Task<TalabatCallResult> PostAsync(string url, object? body, CancellationToken ct) => CallAsync(HttpMethod.Post, url, body, ct);

    /// <summary>A call on the middleware's own API, by its path (/v2/chains/…).</summary>
    public Task<TalabatCallResult> CallPathAsync(HttpMethod method, string path, object? body, CancellationToken ct)
        => CallAsync(method, $"{Talabat.MiddlewareUrl!.TrimEnd('/')}{path}", body, ct);

    private async Task<TalabatCallResult> CallAsync(HttpMethod method, string url, object? body, CancellationToken ct)
    {
        var result = await SendAsync(method, url, body, ct);
        if (result.Status == StatusCodes.Status401Unauthorized)
        {
            // A token the middleware stopped taking early: once more with a fresh one
            _token = null;
            result = await SendAsync(method, url, body, ct);
        }
        return result;
    }

    private async Task<TalabatCallResult> SendAsync(HttpMethod method, string url, object? body, CancellationToken ct)
    {
        var client = http.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(method, url)
        {
            Content = body is null ? null : JsonContent.Create(body, options: Json),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await TokenAsync(ct));
        using var response = await client.SendAsync(request, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        return new((int)response.StatusCode, text.Length > 2000 ? text[..2000] : text);
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        if (_token is { } cached && cached.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
            return cached.Token;

        await _login.WaitAsync(ct);
        try
        {
            if (_token is { } again && again.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
                return again.Token;

            var client = http.CreateClient(HttpClientName);
            using var response = await client.PostAsync($"{Talabat.MiddlewareUrl!.TrimEnd('/')}/v2/login", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["username"] = Talabat.Username!,
                ["password"] = Talabat.Password!,
                ["grant_type"] = "client_credentials",
            }), ct);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                logger.LogError("Talabat refused Ninja's login ({Status}): {Body}", (int)response.StatusCode, error);
                throw new HttpRequestException($"Talabat refused the login ({(int)response.StatusCode}).");
            }

            var login = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!;
            var token = login["access_token"]!.GetValue<string>();
            var expiresIn = login["expires_in"] is JsonValue v && v.TryGetValue<double>(out var s) ? s : 1800;
            _token = (token, DateTimeOffset.UtcNow.AddSeconds(expiresIn));
            return token;
        }
        finally
        {
            _login.Release();
        }
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };
}

/// <param name="BranchId">The business's branch; its remote id is derived from the business's own slug.</param>
/// <param name="Catalog">Talabat's catalog object ({ items: { … } }), as the business's catalog built it.</param>
public sealed record TalabatCatalogRelay(int BranchId, JsonObject Catalog);

/// <param name="Type">ITEM for menu items, TOPPING for options.</param>
/// <param name="Items">The remote codes Ninja gave them (item-12, option-7).</param>
public sealed record TalabatItemsRelay(int BranchId, string Type, IReadOnlyList<string> Items, bool IsAvailable);

public sealed record TalabatStoreRelay(int BranchId, bool Open);

/// <summary>One platform's store for a branch, as the middleware's availability answer lists it.</summary>
public sealed record TalabatStore(string State, bool Changeable, string PlatformKey, string PlatformRestaurantId, IReadOnlyList<string> ClosingReasons)
{
    /// <summary>"CLOSED" when Talabat takes it for this store, whatever it takes otherwise.</summary>
    public string CloseReason() => ClosingReasons.Contains("CLOSED") ? "CLOSED" : ClosingReasons.FirstOrDefault() ?? "OTHER";
}

public static class TalabatStores
{
    /// <summary>The Talabat store in the middleware's answer (it lists every platform the branch is on); the only one when there is one.</summary>
    public static TalabatStore? Pick(string body)
    {
        if (JsonNode.Parse(body) is not JsonArray stores || stores.Count == 0) return null;
        var store = stores.OfType<JsonObject>().FirstOrDefault(s => string.Equals(s["platformType"]?.GetValue<string>(), "TALABAT", StringComparison.OrdinalIgnoreCase))
            ?? (stores.Count == 1 ? stores[0] as JsonObject : null);
        if (store is null) return null;
        return new(
            store["availabilityState"]?.GetValue<string>() ?? "UNKNOWN",
            store["changeable"]?.GetValue<bool>() ?? false,
            store["platformKey"]?.GetValue<string>() ?? "",
            store["platformRestaurantId"]?.ToString() ?? "",
            store["closingReasons"] is JsonArray reasons ? reasons.Select(r => r?.GetValue<string>() ?? "").Where(r => r.Length > 0).ToList() : []);
    }
}