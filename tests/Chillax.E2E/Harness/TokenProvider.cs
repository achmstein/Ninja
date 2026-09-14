using System.Text;

namespace Chillax.E2E.Harness;

/// <summary>The three seeded realm users the scenarios act as (chillax-realm.json).</summary>
public enum Persona
{
    /// <summary>cashier / Cashier123$ - role Cashier, branches ["1"]; signs in through the pos-app client.</summary>
    Cashier,

    /// <summary>admin / Admin123$ - roles Admin + Owner (Owner bypasses the branch check); admin-app client.</summary>
    Admin,

    /// <summary>tester / Tester123$ - role Customer; mobile-app client.</summary>
    Tester,
}

public sealed record AccessToken(
    string Value,
    string Subject,
    string PreferredUsername,
    string? Name,
    DateTimeOffset ExpiresAt,
    IReadOnlyList<string> Roles,
    IReadOnlyList<int> Branches)
{
    public bool IsFresh => ExpiresAt - TimeSpan.FromSeconds(60) > DateTimeOffset.UtcNow;
}

/// <summary>
/// Keycloak password-grant tokens, the way pos_app signs in. Cached per
/// persona: the realm has brute-force protection and a token lives two hours.
/// </summary>
public sealed class TokenProvider(Uri keycloakBaseAddress) : IDisposable
{
    public const string Realm = "chillax";

    private static readonly (string ClientId, string Username, string Password)[] Credentials =
    [
        ("pos-app", "cashier", "Cashier123$"),
        ("admin-app", "admin", "Admin123$"),
        ("mobile-app", "tester", "Tester123$"),
    ];

    private readonly HttpClient _http = new() { BaseAddress = keycloakBaseAddress, Timeout = TimeSpan.FromSeconds(30) };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Dictionary<Persona, AccessToken> _cache = [];

    public Uri KeycloakBaseAddress { get; } = keycloakBaseAddress;

    public async Task<AccessToken> GetAsync(Persona persona, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue(persona, out var cached) && cached.IsFresh)
                return cached;

            var (clientId, username, password) = Credentials[(int)persona];
            var token = await PasswordGrantAsync(clientId, username, password, ct);
            _cache[persona] = token;
            return token;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Raw ROPC call; for users a scenario registers itself.</summary>
    public async Task<AccessToken> PasswordGrantAsync(string clientId, string username, string password, CancellationToken ct)
    {
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = clientId,
            ["username"] = username,
            ["password"] = password,
            ["scope"] = "openid",
        });

        using var response = await _http.PostAsync($"realms/{Realm}/protocol/openid-connect/token", content, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak password grant for '{username}' via '{clientId}' failed: {(int)response.StatusCode}\n{body}");

        using var doc = JsonDocument.Parse(body);
        var accessToken = doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Keycloak returned no access_token");
        return Parse(accessToken);
    }

    /// <summary>Reads the claims the services key on straight out of the JWT payload.</summary>
    public static AccessToken Parse(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length < 2)
            throw new FormatException("Not a JWT");

        using var payload = JsonDocument.Parse(Base64UrlDecode(parts[1]));
        var root = payload.RootElement;

        return new AccessToken(
            jwt,
            root.GetProperty("sub").GetString()!,
            root.TryGetProperty("preferred_username", out var pu) ? pu.GetString() ?? "" : "",
            root.TryGetProperty("name", out var n) ? n.GetString() : null,
            DateTimeOffset.FromUnixTimeSeconds(root.GetProperty("exp").GetInt64()),
            Strings(root, "role"),
            Strings(root, "branches").Select(b => int.Parse(b, System.Globalization.CultureInfo.InvariantCulture)).ToArray());
    }

    // Keycloak multivalued mappers emit an array for several values and a bare string for one.
    private static IReadOnlyList<string> Strings(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el))
            return [];
        return el.ValueKind switch
        {
            JsonValueKind.Array => el.EnumerateArray().Select(e => e.GetString()!).ToArray(),
            JsonValueKind.String => [el.GetString()!],
            _ => [],
        };
    }

    private static byte[] Base64UrlDecode(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    public void Dispose()
    {
        _http.Dispose();
        _gate.Dispose();
    }
}
