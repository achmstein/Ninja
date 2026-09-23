using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Ninja.Assistant.API.Auth;

/// <summary>
/// The chat app's token says "for assistant-api" and never leaves this
/// service. What the other services see is assistant-api's own token for the
/// same owner, minted by Keycloak standard token exchange (RFC 8693) and
/// cached until a minute before the earlier of the two expiries. A downstream
/// 401 evicts it so the next call exchanges again.
/// </summary>
public sealed class TokenExchanger(
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    IOptions<AssistantOptions> options,
    IConfiguration configuration,
    IHttpContextAccessor httpContextAccessor,
    TimeProvider clock,
    ILogger<TokenExchanger> logger)
{
    public const string HttpClientName = "keycloak-token-exchange";
    private const string GrantType = "urn:ietf:params:oauth:grant-type:token-exchange";
    private const string AccessTokenType = "urn:ietf:params:oauth:token-type:access_token";

    public async Task<ExchangeResult> GetDownstreamTokenAsync(CancellationToken ct)
    {
        var inbound = InboundToken();
        if (inbound is null)
            return ExchangeResult.Fail("The request carried no sign-in token. Reconnect the Ninja connector.");

        var te = options.Value.TokenExchange;
        if (!te.Enabled)
            return ExchangeResult.Ok(inbound);

        var key = CacheKey(inbound);
        // The entry remembers its own deadline: the cache's clock and this one need not agree
        if (cache.TryGetValue(key, out Cached? cached) && cached is not null && cached.ExpiresAt > clock.GetUtcNow())
            return ExchangeResult.Ok(cached.Token);

        var realmUrl = configuration["Identity:Url"]?.TrimEnd('/');
        if (string.IsNullOrEmpty(realmUrl))
            return ExchangeResult.Fail("The assistant is not connected to the realm (Identity:Url is unset).");

        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = GrantType,
            ["client_id"] = te.ClientId,
            ["client_secret"] = te.ClientSecret,
            ["subject_token"] = inbound,
            ["subject_token_type"] = AccessTokenType,
            ["requested_token_type"] = AccessTokenType,
        });

        HttpResponseMessage response;
        try
        {
            response = await httpClientFactory.CreateClient(HttpClientName)
                .PostAsync($"{realmUrl}/protocol/openid-connect/token", form, ct);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Token exchange: the realm is not reachable");
            return ExchangeResult.Fail("The sign-in service is not reachable right now; try again in a moment.");
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Token exchange refused: {Status} {Body}", (int)response.StatusCode, Cap(body));
                return ExchangeResult.Fail("Your sign-in could not be exchanged for a service token. Reconnect the Ninja connector and try again.");
            }

            using var doc = JsonDocument.Parse(body);
            var token = doc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            if (string.IsNullOrEmpty(token))
                return ExchangeResult.Fail("The sign-in service answered without a token. Reconnect the Ninja connector and try again.");

            var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var seconds) ? seconds : 300;
            var now = clock.GetUtcNow();
            var ttl = TimeSpan.FromSeconds(expiresIn);
            if (JwtExpiry(inbound) is { } inboundExpiry && inboundExpiry - now < ttl)
                ttl = inboundExpiry - now;
            ttl -= TimeSpan.FromSeconds(60);
            if (ttl > TimeSpan.Zero)
                cache.Set(key, new Cached(token, now + ttl), ttl);

            return ExchangeResult.Ok(token);
        }
    }

    /// <summary>Called when a service answered 401 to the exchanged token: the next call exchanges afresh.</summary>
    public void Forget()
    {
        if (InboundToken() is { } inbound)
            cache.Remove(CacheKey(inbound));
    }

    private string? InboundToken()
    {
        var header = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(header) || !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = header["Bearer ".Length..].Trim();
        return token.Length == 0 ? null : token;
    }

    private static string CacheKey(string inbound)
        => "token-exchange:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(inbound)));

    /// <summary>The inbound token's exp, read without validating: the JWT handler already did that.</summary>
    internal static DateTimeOffset? JwtExpiry(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Convert.FromBase64String(payload));
            return doc.RootElement.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var seconds)
                ? DateTimeOffset.FromUnixTimeSeconds(seconds)
                : null;
        }
        catch (FormatException) { return null; }
        catch (JsonException) { return null; }
    }

    private static string Cap(string s) => s.Length <= 300 ? s : s[..300] + "...";

    private sealed record Cached(string Token, DateTimeOffset ExpiresAt);
}

public readonly record struct ExchangeResult(string? Token, string? Error)
{
    public bool IsOk => Error is null;
    public static ExchangeResult Ok(string token) => new(token, null);
    public static ExchangeResult Fail(string error) => new(null, error);
}
