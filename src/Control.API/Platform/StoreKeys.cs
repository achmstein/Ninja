using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Ninja.Control.API.Platform;

/// <summary>A Google service account's key file, the parts the control plane uses.</summary>
public sealed record GoogleServiceAccount(string ClientEmail, string PrivateKey, string ProjectId, string TokenUri)
{
    /// <summary>The key file as Google gives it, checked; null and an error when it is not one.</summary>
    public static GoogleServiceAccount? Parse(string? json, out string? error)
    {
        error = null;
        JsonObject? file;
        try
        {
            file = string.IsNullOrWhiteSpace(json) ? null : JsonNode.Parse(json) as JsonObject;
        }
        catch (JsonException)
        {
            file = null;
        }
        string? Read(string key) => file?[key] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) ? s : null;
        if (file is null || Read("type") != "service_account" || Read("client_email") is not { } email || Read("private_key") is not { } key)
        {
            error = "This is not a Google service account's key file: Google Cloud › IAM › Service accounts › Keys › Add key › JSON gives one.";
            return null;
        }
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportFromPem(key);
        }
        catch (Exception e) when (e is CryptographicException or ArgumentException)
        {
            error = "The key file's private key does not read.";
            return null;
        }
        return new GoogleServiceAccount(email, key, Read("project_id") ?? "", Read("token_uri") ?? "https://oauth2.googleapis.com/token");
    }

    /// <summary>An access token for the scope, from Google's token endpoint with a signed assertion (RS256).</summary>
    public async Task<string> AccessTokenAsync(HttpClient http, string scope, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var rsa = RSA.Create();
        rsa.ImportFromPem(PrivateKey);
        var assertion = StoreKeys.Jwt(
            new JsonObject { ["alg"] = "RS256", ["typ"] = "JWT" },
            new JsonObject { ["iss"] = ClientEmail, ["scope"] = scope, ["aud"] = TokenUri, ["iat"] = now, ["exp"] = now + 3600 },
            data => rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        using var response = await http.PostAsync(TokenUri, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
            ["assertion"] = assertion,
        }), ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new StoreKeyException($"Google refused the service account {ClientEmail}: {StoreKeys.ErrorOf(body)}");
        return JsonNode.Parse(body)?["access_token"]?.GetValue<string>() ?? throw new StoreKeyException("Google answered without a token.");
    }
}

/// <summary>A key a store or Google refused, said for the console.</summary>
public sealed class StoreKeyException(string message) : Exception(message);

/// <summary>
/// The stores' API keys checked from the server, so a build does not find out fifteen minutes in:
/// the App Store Connect key signs a token (ES256) Apple takes and finds the app, and the Play service
/// account opens and drops an edit on the package, which only release rights allow.
/// </summary>
public static class StoreKeys
{
    public const string PlayScope = "https://www.googleapis.com/auth/androidpublisher";

    /// <summary>header.payload.signature, each base64url</summary>
    public static string Jwt(JsonObject header, JsonObject payload, Func<byte[], byte[]> sign)
    {
        var signing = $"{Base64Url(Encoding.UTF8.GetBytes(header.ToJsonString()))}.{Base64Url(Encoding.UTF8.GetBytes(payload.ToJsonString()))}";
        return $"{signing}.{Base64Url(sign(Encoding.ASCII.GetBytes(signing)))}";
    }

    public static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>Whether the .p8 reads as the EC key App Store Connect gives.</summary>
    public static bool IsAscKey(string pem)
    {
        try
        {
            using var ec = ECDsa.Create();
            ec.ImportFromPem(pem);
            return ec.KeySize == 256;
        }
        catch (Exception e) when (e is CryptographicException or ArgumentException)
        {
            return false;
        }
    }

    /// <summary>A token App Store Connect takes for twenty minutes at most.</summary>
    public static string AscToken(string keyId, string issuerId, string privateKey)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var ec = ECDsa.Create();
        ec.ImportFromPem(privateKey);
        return Jwt(
            new JsonObject { ["alg"] = "ES256", ["kid"] = keyId, ["typ"] = "JWT" },
            new JsonObject { ["iss"] = issuerId, ["iat"] = now, ["exp"] = now + 1200, ["aud"] = "appstoreconnect-v1" },
            data => ec.SignData(data, HashAlgorithmName.SHA256));
    }

    /// <summary>The app in App Store Connect with the bundle ID; throws with what Apple said.</summary>
    public static async Task<string> FindAscAppAsync(HttpClient http, string keyId, string issuerId, string privateKey, string bundleId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]={Uri.EscapeDataString(bundleId)}&fields[apps]=name,bundleId");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AscToken(keyId, issuerId, privateKey));
        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new StoreKeyException($"App Store Connect refused the key ({(int)response.StatusCode}): {ErrorOf(body)}");
        var apps = JsonNode.Parse(body)?["data"]?.AsArray() ?? [];
        var app = apps.FirstOrDefault(a => a?["attributes"]?["bundleId"]?.GetValue<string>() == bundleId)
            ?? throw new StoreKeyException($"The key works, but its account has no app with the bundle ID {bundleId} yet: add it in App Store Connect.");
        return app["attributes"]?["name"]?.GetValue<string>() ?? bundleId;
    }

    /// <summary>
    /// The capabilities ios/Runner/Runner.entitlements asks for; Sign in with Apple as a primary App ID,
    /// not grouped with another (Apple gives a person's name once per group). The Live Activity's
    /// extension asks for none.
    /// </summary>
    private static readonly (string Type, JsonArray? Settings)[] AppCapabilities =
    [
        ("PUSH_NOTIFICATIONS", null),
        ("ASSOCIATED_DOMAINS", null),
        ("SIGN_IN_WITH_APPLE", [new JsonObject { ["key"] = "APPLE_ID_AUTH_APP_CONSENT", ["options"] = new JsonArray(new JsonObject { ["key"] = "PRIMARY_APP_CONSENT" }) }]),
    ];

    /// <summary>
    /// The app's two App IDs in the business's developer account, made when missing: the app with its
    /// capabilities, and its Live Activity's extension. Match makes the profiles on the first build; the
    /// app's record in App Store Connect is still made there by hand (Apple's API makes none). Says what it did.
    /// </summary>
    public static async Task<List<string>> RegisterAppIdsAsync(HttpClient http, string keyId, string issuerId, string privateKey, string appId, string name, CancellationToken ct)
    {
        var token = AscToken(keyId, issuerId, privateKey);
        var done = new List<string>();

        async Task<JsonNode> Send(HttpMethod method, string path, JsonObject? body)
        {
            using var request = new HttpRequestMessage(method, $"https://api.appstoreconnect.apple.com/v1/{path}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body is not null) request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
            using var response = await http.SendAsync(request, ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new StoreKeyException($"Apple refused {method} {path.Split('?')[0]} ({(int)response.StatusCode}): {ErrorOf(text)}");
            return string.IsNullOrWhiteSpace(text) ? new JsonObject() : JsonNode.Parse(text) ?? new JsonObject();
        }

        async Task<string> Ensure(string identifier, string label)
        {
            var found = (await Send(HttpMethod.Get, $"bundleIds?filter[identifier]={Uri.EscapeDataString(identifier)}&limit=20", null))["data"]?.AsArray()
                .FirstOrDefault(b => b?["attributes"]?["identifier"]?.GetValue<string>() == identifier);
            if (found is not null) return found["id"]!.GetValue<string>();
            var made = await Send(HttpMethod.Post, "bundleIds", new JsonObject
            {
                ["data"] = new JsonObject
                {
                    ["type"] = "bundleIds",
                    ["attributes"] = new JsonObject { ["identifier"] = identifier, ["name"] = label, ["platform"] = "IOS" },
                },
            });
            done.Add($"Registered the App ID {identifier}");
            return made["data"]!["id"]!.GetValue<string>();
        }

        var appBundle = await Ensure(appId, AppleName(name));
        await Ensure($"{appId}.ChillaxLiveActivity", AppleName($"{name} Live Activity"));

        var have = (await Send(HttpMethod.Get, $"bundleIds/{appBundle}/bundleIdCapabilities", null))["data"]?.AsArray()
            .Select(c => c?["attributes"]?["capabilityType"]?.GetValue<string>()).ToHashSet() ?? [];
        foreach (var (type, settings) in AppCapabilities)
        {
            if (have.Contains(type)) continue;
            var attributes = new JsonObject { ["capabilityType"] = type };
            if (settings is not null) attributes["settings"] = settings.DeepClone();
            await Send(HttpMethod.Post, "bundleIdCapabilities", new JsonObject
            {
                ["data"] = new JsonObject
                {
                    ["type"] = "bundleIdCapabilities",
                    ["attributes"] = attributes,
                    ["relationships"] = new JsonObject { ["bundleId"] = new JsonObject { ["data"] = new JsonObject { ["type"] = "bundleIds", ["id"] = appBundle } } },
                },
            });
            done.Add($"Gave it {type.Replace('_', ' ').ToLowerInvariant()}");
        }
        if (done.Count == 0) done.Add("The App IDs were there already");
        return done;
    }

    /// <summary>Apple's App ID names take letters, digits and spaces only</summary>
    private static string AppleName(string name)
    {
        var kept = new string(name.Where(c => char.IsAsciiLetterOrDigit(c) || c == ' ').ToArray()).Trim();
        return kept.Length == 0 ? "Ninja app" : kept.Length > 60 ? kept[..60] : kept;
    }

    /// <summary>Opens an edit on the package and drops it: Play allows that only with release rights. Throws with what Google said.</summary>
    public static async Task CheckPlayAsync(HttpClient http, GoogleServiceAccount account, string packageName, CancellationToken ct)
    {
        var token = await account.AccessTokenAsync(http, PlayScope, ct);
        var edits = $"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{Uri.EscapeDataString(packageName)}/edits";
        using var insert = new HttpRequestMessage(HttpMethod.Post, edits) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
        insert.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await http.SendAsync(insert, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new StoreKeyException(response.StatusCode == System.Net.HttpStatusCode.NotFound
                ? $"Play has no app {packageName} the service account can see: create it in Play Console and give {account.ClientEmail} release rights."
                : $"Play refused {account.ClientEmail} on {packageName} ({(int)response.StatusCode}): {ErrorOf(body)}");
        if (JsonNode.Parse(body)?["id"]?.GetValue<string>() is { } id)
        {
            using var delete = new HttpRequestMessage(HttpMethod.Delete, $"{edits}/{Uri.EscapeDataString(id)}");
            delete.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var _ = await http.SendAsync(delete, ct);
        }
    }

    /// <summary>
    /// The SHA-256 of the key Play signs the installed app with (Play App Signing), AA:BB:…: read off the
    /// APKs Play made of the newest release on any track (generatedapks.list). Null while Play has none.
    /// Play's API gives no SHA-1 of it, which Google sign-in's Android client needs: that one is still
    /// copied from Play Console (App integrity).
    /// </summary>
    public static async Task<string?> PlaySigningSha256Async(HttpClient http, GoogleServiceAccount account, string packageName, CancellationToken ct)
    {
        var token = await account.AccessTokenAsync(http, PlayScope, ct);
        var app = $"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{Uri.EscapeDataString(packageName)}";
        async Task<JsonNode?> SendAsync(HttpMethod method, string url, string? body = null)
        {
            using var request = new HttpRequestMessage(method, url);
            if (body is not null) request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await http.SendAsync(request, ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new StoreKeyException($"Play refused {account.ClientEmail} on {packageName} ({(int)response.StatusCode}): {ErrorOf(text)}");
            return text.Length == 0 ? null : JsonNode.Parse(text);
        }

        // The newest version code on any track, read in an edit thrown away after
        var edit = (await SendAsync(HttpMethod.Post, $"{app}/edits", "{}"))?["id"]?.GetValue<string>()
            ?? throw new StoreKeyException("Play opened no edit.");
        long newest = 0;
        try
        {
            var tracks = await SendAsync(HttpMethod.Get, $"{app}/edits/{Uri.EscapeDataString(edit)}/tracks");
            foreach (var track in tracks?["tracks"]?.AsArray() ?? [])
            foreach (var release in track?["releases"]?.AsArray() ?? [])
            foreach (var code in release?["versionCodes"]?.AsArray() ?? [])
                if (long.TryParse(code?.ToString(), out var n) && n > newest) newest = n;
        }
        finally
        {
            try { await SendAsync(HttpMethod.Delete, $"{app}/edits/{Uri.EscapeDataString(edit)}"); }
            catch (StoreKeyException) { }
        }
        if (newest == 0) return null;

        var generated = await SendAsync(HttpMethod.Get, $"{app}/generatedApks/{newest}");
        foreach (var signed in generated?["generatedApks"]?.AsArray() ?? [])
            if (Sha256Of(signed?["certificateSha256Hash"]?.GetValue<string>()) is { } sha256) return sha256;
        return null;
    }

    /// <summary>A certificate hash as Play gives it (hex, or base64) in the record's AA:BB:… form.</summary>
    internal static string? Sha256Of(string? hash)
    {
        if (string.IsNullOrWhiteSpace(hash)) return null;
        var hex = hash.Replace(":", "").Trim();
        byte[]? bytes = null;
        if (hex.Length == 64 && hex.All(Uri.IsHexDigit)) bytes = System.Convert.FromHexString(hex);
        else
        {
            try { bytes = System.Convert.FromBase64String(hash.Replace('-', '+').Replace('_', '/').PadRight((hash.Length + 3) / 4 * 4, '=')); }
            catch (FormatException) { }
        }
        return bytes is { Length: 32 } ? string.Join(':', bytes.Select(b => b.ToString("X2"))) : null;
    }

    /// <summary>The message out of a Google or Apple error body, or the body cut short.</summary>
    public static string ErrorOf(string body)
    {
        try
        {
            var json = JsonNode.Parse(body);
            var message = json?["error"]?["message"]?.GetValue<string>()
                ?? json?["error_description"]?.GetValue<string>()
                ?? json?["errors"]?[0]?["detail"]?.GetValue<string>()
                ?? (json?["error"] is JsonValue e ? e.GetValue<string>() : null)
                ?? (json?["message"] is JsonValue m ? m.GetValue<string>() : null);
            if (message is not null) return message;
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
        }
        return body.Length > 300 ? body[..300] + "…" : body;
    }
}
