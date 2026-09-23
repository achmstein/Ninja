using System.Net;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>Where one tenant stands against what its tag points to now.</summary>
/// <param name="Behind">Some service runs an older build than its tag's current one, or a newer release exists.</param>
/// <param name="Services">The services running an older build; empty when it is the tag itself that is old.</param>
/// <param name="NewerTag">A release newer than the tag the tenant is on, when there is one.</param>
public sealed record TenantUpdate(bool Behind, IReadOnlyList<string> Services, string? NewerTag)
{
    public static readonly TenantUpdate Current = new(false, [], null);
}

/// <summary>What the last check found: the releases the registry holds and each tenant's standing, by slug.</summary>
public sealed record UpdateSnapshot(DateTimeOffset At, IReadOnlyList<string> Releases, IReadOnlyDictionary<string, TenantUpdate> Tenants)
{
    /// <summary>The newest release tag, or null while the registry has none (or was never asked).</summary>
    public string? NewestRelease => Releases.Count > 0 ? Releases[0] : null;
}

/// <summary>The registry the service images come from, read without pulling anything.</summary>
public interface IImageRegistry
{
    /// <summary>The tags one service's image carries; empty when the registry cannot be asked.</summary>
    Task<IReadOnlyList<string>> TagsAsync(string service, CancellationToken ct);

    /// <summary>
    /// Every id docker may report for the image a tag resolves to on this
    /// box's architecture: the tag's own digest (an index, on the containerd
    /// image store), this architecture's manifest digest, and the config
    /// digest (the classic store's image id). Empty when unknown.
    /// </summary>
    Task<IReadOnlyList<string>> ImageIdsAsync(string service, string tag, CancellationToken ct);
}

/// <summary>The arithmetic of "behind", apart from docker and the registry so it can be tested.</summary>
public static partial class UpdateMath
{
    [GeneratedRegex(@"^v\d")]
    private static partial Regex ReleaseTag();

    /// <summary>A release is a tag like v2026.09.21: what a release build stamps on all twelve services at once.</summary>
    public static bool IsRelease(string tag) => ReleaseTag().IsMatch(tag);

    /// <summary>Release tags newest first: numbers compare as numbers, so v2026.10.1 is after v2026.9.30.</summary>
    public static IReadOnlyList<string> OrderReleases(IEnumerable<string> tags)
        => tags.Where(IsRelease).Distinct().OrderByDescending(t => t, ReleaseComparer.Instance).ToList();

    /// <summary>
    /// One tenant against the newest builds: a service whose container runs an
    /// image other than the one its tag points to now is behind, and a tenant
    /// on a release older than the newest is behind on the tag itself. A
    /// service nobody can say anything about (no container, or the tag's
    /// current image unknown) counts as current. The tag's image goes by
    /// several ids (see <see cref="IImageRegistry.ImageIdsAsync"/>); running
    /// any one of them is running it.
    /// </summary>
    public static TenantUpdate Assess(string tag, IReadOnlyDictionary<string, string> running, Func<string, IReadOnlyCollection<string>?> newestIds, string? newestRelease)
    {
        var behind = new List<string>();
        foreach (var service in TenantNaming.Services)
        {
            if (!running.TryGetValue(service, out var runs)) continue;
            var newest = newestIds(service);
            if (newest is { Count: > 0 } && !newest.Contains(runs, StringComparer.Ordinal)) behind.Add(service);
        }

        string? newerTag = null;
        if (newestRelease is not null && IsRelease(tag) && ReleaseComparer.Instance.Compare(newestRelease, tag) > 0)
            newerTag = newestRelease;

        return behind.Count == 0 && newerTag is null ? TenantUpdate.Current : new(true, behind, newerTag);
    }

    private sealed class ReleaseComparer : IComparer<string>
    {
        public static readonly ReleaseComparer Instance = new();

        public int Compare(string? x, string? y)
        {
            var a = Parts(x ?? ""); var b = Parts(y ?? "");
            for (var i = 0; i < Math.Max(a.Length, b.Length); i++)
            {
                var pa = i < a.Length ? a[i] : ""; var pb = i < b.Length ? b[i] : "";
                var c = long.TryParse(pa, out var na) && long.TryParse(pb, out var nb) ? na.CompareTo(nb) : string.CompareOrdinal(pa, pb);
                if (c != 0) return c;
            }
            return 0;
        }

        private static string[] Parts(string tag) => tag.TrimStart('v', 'V').Split(['.', '-', '_'], StringSplitOptions.RemoveEmptyEntries);
    }
}

/// <summary>
/// The last check, refreshed on a timer and after every job so the control
/// app can ask "who is behind" without docker or the registry being touched
/// on each request. A refresh reads what every container of every stack
/// runs (one docker inspect), what each tag resolves to on the box (docker
/// images) and, where the platform pulls, what it resolves to in the
/// registry; the registry's answer wins where it has one.
/// </summary>
public sealed class UpdateCache(IServiceScopeFactory scopes, IShell shell, IImageRegistry registry, IOptions<PlatformOptions> options, ILogger<UpdateCache> logger)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    public UpdateSnapshot? Latest { get; private set; }

    /// <summary>Set after a job changed a stack; the monitor refreshes on its next tick instead of waiting the interval out.</summary>
    public bool Stale { get; private set; }

    public void Invalidate() => Stale = true;

    public TenantUpdate? For(string slug) => Latest?.Tenants.GetValueOrDefault(slug);

    public async Task<UpdateSnapshot> GetAsync(bool refresh, CancellationToken ct)
        => Latest is { } latest && !refresh && !Stale ? latest : await RefreshAsync(ct);

    public async Task<UpdateSnapshot> RefreshAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            Stale = false;
            Latest = await ProbeAsync(ct);
            return Latest;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<UpdateSnapshot> ProbeAsync(CancellationToken ct)
    {
        var platform = options.Value;
        List<(string Slug, string Tag)> tenants;
        using (var scope = scopes.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
            tenants = await context.Tenants.AsNoTracking()
                .Where(t => t.Status != TenantStatus.Destroyed)
                .Select(t => new ValueTuple<string, string>(t.Slug, t.ImageTag))
                .ToListAsync(ct);
        }

        var running = await RunningImagesAsync(ct);
        var local = await LocalImagesAsync(ct);

        // The registry, once per service and tag in use; a tag it cannot answer for falls back to the box's copy
        var newest = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        IReadOnlyList<string> releases = [];
        if (platform.PullImages)
        {
            var tags = tenants.Select(t => t.Tag).Distinct().ToList();
            var lookups = TenantNaming.Services.SelectMany(s => tags.Select(t => (Service: s, Tag: t))).ToList();
            var ids = await Task.WhenAll(lookups.Select(l => registry.ImageIdsAsync(l.Service, l.Tag, ct)));
            for (var i = 0; i < lookups.Count; i++)
                if (ids[i].Count > 0) newest[$"{lookups[i].Service}:{lookups[i].Tag}"] = ids[i];

            // A release is a tag every one of the twelve carries
            var perService = await Task.WhenAll(TenantNaming.Services.Select(s => registry.TagsAsync(s, ct)));
            if (perService.All(list => list.Count > 0))
                releases = UpdateMath.OrderReleases(perService.Skip(1).Aggregate(perService[0].AsEnumerable(), (acc, list) => acc.Intersect(list, StringComparer.Ordinal)));
        }

        var result = new Dictionary<string, TenantUpdate>(StringComparer.Ordinal);
        foreach (var (slug, tag) in tenants)
        {
            var project = TenantNaming.Project(slug);
            var runs = running.TryGetValue(project, out var services) ? services : new Dictionary<string, string>(StringComparer.Ordinal);
            result[slug] = UpdateMath.Assess(tag, runs, service =>
                newest.TryGetValue($"{service}:{tag}", out var fromRegistry) ? fromRegistry
                : local.TryGetValue($"{platform.ImageRegistry}-{service}:{tag}", out var onBox) ? [onBox]
                : null, releases.Count > 0 ? releases[0] : null);
        }

        logger.LogInformation("Update check: {Behind} of {Total} tenants behind, {Releases} releases", result.Count(r => r.Value.Behind), result.Count, releases.Count);
        return new UpdateSnapshot(DateTimeOffset.UtcNow, releases, result);
    }

    /// <summary>Every container docker has, by compose project then service suffix, with the id of the image it runs.</summary>
    private async Task<Dictionary<string, Dictionary<string, string>>> RunningImagesAsync(CancellationToken ct)
    {
        var byProject = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        var ps = await shell.RunAsync("docker", ["ps", "-a", "--filter", "label=com.docker.compose.project", "--format", "{{.ID}}"], null, ct);
        var ids = ps.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!ps.Ok || ids.Length == 0) return byProject;

        var inspect = await shell.RunAsync("docker", ["inspect", "--format", "{{index .Config.Labels \"com.docker.compose.project\"}}\t{{index .Config.Labels \"com.docker.compose.service\"}}\t{{.Image}}", .. ids], null, ct);
        foreach (var line in inspect.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t');
            if (parts.Length != 3 || !parts[0].StartsWith("ninja-", StringComparison.Ordinal)) continue;
            var slug = parts[0]["ninja-".Length..];
            // {slug}-{service}-api is the compose service; the gateway and anything else is not a versioned image of ours
            var prefix = $"{slug}-"; const string suffix = "-api";
            if (!parts[1].StartsWith(prefix, StringComparison.Ordinal) || !parts[1].EndsWith(suffix, StringComparison.Ordinal)) continue;
            var service = parts[1][prefix.Length..^suffix.Length];
            if (!byProject.TryGetValue(parts[0], out var services)) byProject[parts[0]] = services = new(StringComparer.Ordinal);
            services[service] = parts[2].Trim();
        }
        return byProject;
    }

    /// <summary>What each tag on the box resolves to: repository:tag → image id.</summary>
    private async Task<Dictionary<string, string>> LocalImagesAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        var images = await shell.RunAsync("docker", ["images", "--no-trunc", "--format", "{{.Repository}}:{{.Tag}}\t{{.ID}}"], null, ct);
        if (!images.Ok) return map;
        foreach (var line in images.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t');
            if (parts.Length == 2) map[parts[0]] = parts[1].Trim();
        }
        return map;
    }
}

/// <summary>Reads the box on the interval, and sooner when a job left the cache stale.</summary>
public sealed class UpdateMonitor(UpdateCache cache, IOptions<PlatformOptions> options, ILogger<UpdateMonitor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            var interval = TimeSpan.FromSeconds(Math.Max(60, options.Value.UpdateRefreshSeconds));
            var due = cache.Latest is null || cache.Stale || DateTimeOffset.UtcNow - cache.Latest.At >= interval;
            if (!due) continue;
            try
            {
                await cache.RefreshAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Could not check the tenants for updates");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

/// <summary>
/// The registry over the OCI distribution API: a tags list and, for a tag,
/// the digests docker may show as the image id once it is pulled: the tag's
/// own (the containerd image store, Docker 29's default, shows the index),
/// this architecture's manifest, and its config (the classic store). Anonymous
/// where the packages are public; the registry's own token dance
/// (WWW-Authenticate: Bearer realm=...) with the platform's credentials
/// where they are not.
/// </summary>
public sealed class OciImageRegistry(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options, ILogger<OciImageRegistry> logger) : IImageRegistry
{
    private const string ManifestAccept = "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json";

    private static readonly string Arch = RuntimeInformation.OSArchitecture switch
    {
        Architecture.Arm64 => "arm64",
        Architecture.Arm => "arm",
        _ => "amd64",
    };

    // One bearer token per repository, good for the registry's lifetime of it (minutes); refetched on the next 401
    private readonly Dictionary<string, string> _tokens = new(StringComparer.Ordinal);

    public async Task<IReadOnlyList<string>> TagsAsync(string service, CancellationToken ct)
    {
        var (host, repository) = Split(service);
        if (host is null) return [];
        var doc = await GetJsonAsync(host, repository, $"tags/list?n=1000", accept: null, ct);
        return doc?["tags"] is JsonArray tags ? tags.Select(t => t?.GetValue<string>()).OfType<string>().ToList() : [];
    }

    public async Task<IReadOnlyList<string>> ImageIdsAsync(string service, string tag, CancellationToken ct)
    {
        var (host, repository) = Split(service);
        if (host is null) return [];
        var (manifest, tagDigest) = await GetManifestAsync(host, repository, tag, ct);
        if (manifest is null) return [];
        var ids = new List<string>();
        if (tagDigest is not null) ids.Add(tagDigest);

        // An index: the one manifest built for this architecture (attestations say unknown/unknown)
        if (manifest["manifests"] is JsonArray list)
        {
            var mine = list.FirstOrDefault(m => m?["platform"]?["os"]?.GetValue<string>() == "linux" && m?["platform"]?["architecture"]?.GetValue<string>() == Arch);
            var digest = mine?["digest"]?.GetValue<string>();
            if (digest is null) return [];
            ids.Add(digest);
            (manifest, _) = await GetManifestAsync(host, repository, digest, ct);
        }
        if (manifest?["config"]?["digest"]?.GetValue<string>() is { } config) ids.Add(config);
        return ids;
    }

    /// <summary>A manifest and the digest the registry gives it (Docker-Content-Digest): for a tag, what the tag resolves to.</summary>
    private async Task<(JsonObject? Manifest, string? Digest)> GetManifestAsync(string host, string repository, string reference, CancellationToken ct)
    {
        string? digest = null;
        var manifest = await GetJsonAsync(host, repository, $"manifests/{reference}", ManifestAccept, ct,
            response => digest = response.Headers.TryGetValues("Docker-Content-Digest", out var values) ? values.FirstOrDefault() : null);
        return (manifest, digest);
    }

    /// <summary>ghcr.io/achmstein/ninja + branch → (ghcr.io, achmstein/ninja-branch); no host (images built on the box) → nothing to ask.</summary>
    private (string? Host, string Repository) Split(string service)
    {
        var image = $"{options.Value.ImageRegistry}-{service}";
        var slash = image.IndexOf('/');
        if (slash < 0) return (null, image);
        var host = image[..slash];
        return host.Contains('.') || host.Contains(':') || host == "localhost" ? (host, image[(slash + 1)..]) : (null, image);
    }

    private async Task<JsonObject?> GetJsonAsync(string host, string repository, string path, string? accept, CancellationToken ct, Action<HttpResponseMessage>? read = null)
    {
        var client = httpClientFactory.CreateClient("registry");
        var url = $"https://{host}/v2/{repository}/{path}";
        try
        {
            using var first = await SendAsync(client, url, accept, repository, ct);
            var response = first;
            if (first.StatusCode == HttpStatusCode.Unauthorized && await AuthenticateAsync(client, first, repository, ct))
            {
                first.Dispose();
                response = await SendAsync(client, url, accept, repository, ct);
            }
            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("Registry {Url} answered {Status}", url, (int)response.StatusCode);
                    return null;
                }
                read?.Invoke(response);
                return JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject;
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "Registry {Url} could not be read", url);
            return null;
        }
    }

    private async Task<HttpResponseMessage> SendAsync(HttpClient client, string url, string? accept, string repository, CancellationToken ct)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (accept is not null) request.Headers.TryAddWithoutValidation("Accept", accept);
        string? token;
        lock (_tokens) _tokens.TryGetValue(repository, out token);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    /// <summary>The token the 401 pointed at: realm?service=...&amp;scope=..., with the platform's registry login when it has one.</summary>
    private async Task<bool> AuthenticateAsync(HttpClient client, HttpResponseMessage denied, string repository, CancellationToken ct)
    {
        var challenge = denied.Headers.WwwAuthenticate.FirstOrDefault(h => h.Scheme.Equals("Bearer", StringComparison.OrdinalIgnoreCase));
        if (challenge?.Parameter is null) return false;
        var fields = Regex.Matches(challenge.Parameter, "(\\w+)=\"([^\"]*)\"").ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value, StringComparer.OrdinalIgnoreCase);
        if (!fields.TryGetValue("realm", out var realm)) return false;
        var query = new List<string>();
        if (fields.TryGetValue("service", out var service)) query.Add($"service={Uri.EscapeDataString(service)}");
        query.Add($"scope={Uri.EscapeDataString(fields.GetValueOrDefault("scope", $"repository:{repository}:pull"))}");

        var request = new HttpRequestMessage(HttpMethod.Get, $"{realm}?{string.Join('&', query)}");
        var registry = options.Value.Registry;
        if (!string.IsNullOrEmpty(registry.User) && !string.IsNullOrEmpty(registry.Token))
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{registry.User}:{registry.Token}")));
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) return false;
        var token = (JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject)?["token"]?.GetValue<string>();
        if (token is null) return false;
        lock (_tokens) _tokens[repository] = token;
        return true;
    }
}

/// <summary>Dry run: a registry with whatever the tests (or nobody) put in it.</summary>
public sealed class DryRunImageRegistry : IImageRegistry
{
    /// <summary>service → tag → image id.</summary>
    public Dictionary<string, Dictionary<string, string>> Images { get; } = new(StringComparer.Ordinal);

    public Task<IReadOnlyList<string>> TagsAsync(string service, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<string>>(Images.TryGetValue(service, out var tags) ? tags.Keys.ToList() : []);

    public Task<IReadOnlyList<string>> ImageIdsAsync(string service, string tag, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<string>>(Images.TryGetValue(service, out var tags) && tags.TryGetValue(tag, out var id) ? [id] : []);
}
