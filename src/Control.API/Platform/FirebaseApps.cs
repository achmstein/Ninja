using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace Ninja.Control.API.Platform;

/// <summary>A business's app in the platform's Firebase project, and the file the build puts in place for it.</summary>
public sealed record FirebaseApp(string AppId, string ConfigFile);

/// <summary>What linking a business's app did, for the console.</summary>
public sealed record FirebaseLinkResult(FirebaseApp? Android, FirebaseApp? Ios, IReadOnlyList<string> Done);

/// <summary>
/// The platform's Firebase project through the Firebase Management API, as the Platform page's
/// service account: finds a business's Android app by its package and its iOS app by its bundle ID,
/// or creates them; registers the Android signing certificates (Google's sign-in on Android needs the
/// SHA-1, App Check the SHA-256); and downloads the two config files the build puts in place. Every
/// step is idempotent, so pressing it again changes nothing that is already right.
/// </summary>
public sealed class FirebaseApps(HttpClient http, GoogleServiceAccount account, TimeSpan? pollEvery = null)
{
    public const string ClientName = "firebase";
    private const string Api = "https://firebase.googleapis.com/v1beta1";
    private const string Scope = "https://www.googleapis.com/auth/cloud-platform";

    private readonly TimeSpan _pollEvery = pollEvery ?? TimeSpan.FromSeconds(2);
    private string? _token;

    public string Project => account.ProjectId;

    /// <summary>Every Android package and iOS bundle ID the project has, for the Platform page's test.</summary>
    public async Task<IReadOnlyList<string>> ListAsync(CancellationToken ct)
    {
        var android = await ListAppsAsync("androidApps", ct);
        var ios = await ListAppsAsync("iosApps", ct);
        return [.. android.Select(a => $"Android {a?["packageName"]}"), .. ios.Select(a => $"iOS {a?["bundleId"]}")];
    }

    /// <summary>Finds or makes the business's two apps, gives Android its certificates and downloads both files.</summary>
    public async Task<FirebaseLinkResult> LinkAsync(string appId, string displayName, string? appleTeamId, IReadOnlyList<string> sha1, IReadOnlyList<string> sha256, CancellationToken ct)
    {
        var done = new List<string>();

        var android = (await ListAppsAsync("androidApps", ct)).FirstOrDefault(a => a?["packageName"]?.GetValue<string>() == appId);
        if (android is null)
        {
            android = await CreateAsync("androidApps", new JsonObject { ["packageName"] = appId, ["displayName"] = displayName }, ct);
            done.Add($"Made the Android app {appId}");
        }
        else done.Add($"Found the Android app {appId}");
        var androidId = android["appId"]!.GetValue<string>();

        var have = (await GetAsync($"projects/{Project}/androidApps/{androidId}/sha", ct))["certificates"]?.AsArray()
            .Select(c => c?["shaHash"]?.GetValue<string>()?.ToUpperInvariant()).ToHashSet() ?? [];
        foreach (var (hash, type) in sha1.Select(h => (h, "SHA_1")).Concat(sha256.Select(h => (h, "SHA_256"))))
        {
            var bare = hash.Replace(":", "").ToUpperInvariant();
            if (have.Contains(bare)) continue;
            await PostAsync($"projects/{Project}/androidApps/{androidId}/sha", new JsonObject { ["shaHash"] = bare.ToLowerInvariant(), ["certType"] = type }, ct);
            done.Add($"Added the {type.Replace('_', '-')} {hash[..8]}…");
        }
        var androidFile = await ConfigAsync($"projects/{Project}/androidApps/{androidId}/config", ct);

        var ios = (await ListAppsAsync("iosApps", ct)).FirstOrDefault(a => a?["bundleId"]?.GetValue<string>() == appId);
        if (ios is null)
        {
            var body = new JsonObject { ["bundleId"] = appId, ["displayName"] = displayName };
            if (appleTeamId is not null) body["teamId"] = appleTeamId;
            ios = await CreateAsync("iosApps", body, ct);
            done.Add($"Made the iOS app {appId}");
        }
        else done.Add($"Found the iOS app {appId}");
        var iosId = ios["appId"]!.GetValue<string>();
        var iosFile = await ConfigAsync($"projects/{Project}/iosApps/{iosId}/config", ct);

        return new FirebaseLinkResult(new FirebaseApp(androidId, androidFile), new FirebaseApp(iosId, iosFile), done);
    }

    private async Task<List<JsonNode?>> ListAppsAsync(string kind, CancellationToken ct)
    {
        var apps = new List<JsonNode?>();
        string? page = null;
        do
        {
            var answer = await GetAsync($"projects/{Project}/{kind}?pageSize=100{(page is null ? "" : "&pageToken=" + Uri.EscapeDataString(page))}", ct);
            apps.AddRange(answer["apps"]?.AsArray() ?? []);
            page = answer["nextPageToken"]?.GetValue<string>();
        }
        while (!string.IsNullOrEmpty(page));
        return apps;
    }

    /// <summary>Creating an app is a long-running operation: polled for a minute at most.</summary>
    private async Task<JsonNode> CreateAsync(string kind, JsonObject body, CancellationToken ct)
    {
        var operation = await PostAsync($"projects/{Project}/{kind}", body, ct);
        for (var i = 0; i < 30; i++)
        {
            if (operation["done"]?.GetValue<bool>() == true)
            {
                if (operation["error"] is { } error)
                    throw new StoreKeyException($"Firebase did not make the app: {error["message"]}");
                return operation["response"] ?? throw new StoreKeyException("Firebase made the app but did not say which.");
            }
            await Task.Delay(_pollEvery, ct);
            operation = await GetAsync(operation["name"]!.GetValue<string>(), ct);
        }
        throw new StoreKeyException("Firebase is still making the app after a minute: press it again shortly.");
    }

    private async Task<string> ConfigAsync(string path, CancellationToken ct)
    {
        var config = await GetAsync(path, ct);
        var contents = config["configFileContents"]?.GetValue<string>() ?? throw new StoreKeyException("Firebase gave no config file.");
        return Encoding.UTF8.GetString(Convert.FromBase64String(contents));
    }

    private Task<JsonNode> GetAsync(string path, CancellationToken ct) => SendAsync(HttpMethod.Get, path, null, ct);

    private Task<JsonNode> PostAsync(string path, JsonObject body, CancellationToken ct) => SendAsync(HttpMethod.Post, path, body, ct);

    private async Task<JsonNode> SendAsync(HttpMethod method, string path, JsonObject? body, CancellationToken ct)
    {
        _token ??= await account.AccessTokenAsync(http, Scope, ct);
        using var request = new HttpRequestMessage(method, $"{Api}/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        if (body is not null) request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new StoreKeyException(response.StatusCode == System.Net.HttpStatusCode.Forbidden
                ? $"Firebase refused {account.ClientEmail} on {Project}: give it the Firebase Admin role there. ({StoreKeys.ErrorOf(text)})"
                : $"Firebase answered {(int)response.StatusCode}: {StoreKeys.ErrorOf(text)}");
        return string.IsNullOrWhiteSpace(text) ? new JsonObject() : JsonNode.Parse(text) ?? new JsonObject();
    }
}
