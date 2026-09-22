using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.AcceptanceTests;

/// <summary>What the box says, read the way an admin would read it over the shoulder of the control plane.</summary>
public static class Box
{
    /// <summary>The tenant's containers that are up, by service ({slug}-catalog-api-1 → catalog, the gateway → gateway).</summary>
    public static IReadOnlyList<string> Containers(string slug)
        => Run("docker", ["ps", "--filter", $"name={TenantNaming.Project(slug)}", "--format", "{{.Names}}"])
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(name => name.Trim().Replace($"{TenantNaming.Project(slug)}-{slug}-", "").Replace($"{TenantNaming.Project(slug)}-", ""))
            .Select(name => name.EndsWith("-api-1", StringComparison.Ordinal) ? name[..^6] : name.TrimEnd('-', '1'))
            .Order()
            .ToList();

    /// <summary>The queues on the tenant's vhost, the dead-letter one aside.</summary>
    public static IReadOnlyList<string> Queues(string slug)
        => Run("docker", ["exec", LocalPlatform.BrokerContainer, "rabbitmqctl", "list_queues", "-p", TenantNaming.VHost(slug), "name", "--quiet", "--no-table-headers"])
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Split('\t')[0].Trim())
            .Where(name => name.Length > 0 && name != "dead-letters")
            .Order()
            .ToList();

    public static bool VHostExists(string slug)
        => Run("docker", ["exec", LocalPlatform.BrokerContainer, "rabbitmqctl", "list_vhosts", "--quiet", "--no-table-headers"])
            .Split('\n').Any(line => line.Trim() == TenantNaming.VHost(slug));

    /// <summary>
    /// What the tenant's gateway answers, from outside. On api.{slug} rather
    /// than {slug}: the customer host proxies only /api and /hub to the
    /// gateway and serves the app for everything else, so a probe there
    /// would read the app's own answer.
    /// </summary>
    public static async Task<HttpStatusCode> GatewayAsync(string slug, string path)
    {
        using var http = LocalPlatform.Http($"https://api.{slug}.{LocalPlatform.Domain}");
        using var response = await http.GetAsync(path);
        return response.StatusCode;
    }

    private static string Run(string file, string[] args)
    {
        using var process = Process.Start(new ProcessStartInfo(file)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        }.With(args))!;
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit(TimeSpan.FromMinutes(1));
        return process.ExitCode == 0 ? output : output + error;
    }

    private static ProcessStartInfo With(this ProcessStartInfo info, string[] args)
    {
        foreach (var arg in args) info.ArgumentList.Add(arg);
        return info;
    }
}

/// <summary>The control plane over HTTP, as the control app drives it.</summary>
public sealed class ControlApi
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly HttpClient _http = LocalPlatform.Http(LocalPlatform.ControlUrl);

    public ControlApi() => _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LocalPlatform.Token);

    public Task<TenantDetail> CreateAsync(string slug, TenantPlan plan) => PostAsync<TenantDetail>("/api/control/tenants", new CreateTenantRequest(
        NameEn: $"Acceptance {slug}", NameAr: null, OwnerEmail: $"owner@{slug}.test", Kind: TenantKind.Customer, Slug: slug, Plan: plan, Provision: true, Force: true), HttpStatusCode.Created);

    public Task<TenantDetail> TenantAsync(string slug) => GetAsync<TenantDetail>($"/api/control/tenants/{slug}");
    public Task<List<ServiceHealth>> HealthAsync(string slug) => GetAsync<List<ServiceHealth>>($"/api/control/tenants/{slug}/health");
    public Task<List<ContainerInfo>> ContainersAsync(string slug) => GetAsync<List<ContainerInfo>>($"/api/control/tenants/{slug}/containers");
    public Task<SubscriptionDetail> SetPlanAsync(string slug, TenantPlan plan, Module[]? addons = null)
        => SendAsync<SubscriptionDetail>(HttpMethod.Put, $"/api/control/tenants/{slug}/subscription", new UpdateSubscriptionRequest(plan, addons), HttpStatusCode.OK);
    public Task StopAsync(string slug) => SendAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/stop", null, HttpStatusCode.Accepted);
    public Task StartAsync(string slug) => SendAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/start", null, HttpStatusCode.Accepted);
    public Task DestroyAsync(string slug) => SendAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}", null, HttpStatusCode.Accepted);
    public Task ForgetAsync(string slug) => SendAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}/record", null, HttpStatusCode.NoContent);

    /// <summary>The stamp lane is done with this tenant: nothing queued and nothing in motion.</summary>
    public async Task<TenantDetail> SettledAsync(string slug, TimeSpan within, Action<string>? say = null)
    {
        var clock = Stopwatch.StartNew();
        var last = "";
        while (clock.Elapsed < within)
        {
            var tenant = await TenantAsync(slug);
            var moving = tenant.Jobs.Count > 0 || tenant.Status is TenantStatus.Provisioning or TenantStatus.Upgrading or TenantStatus.Destroying;
            var now = $"{tenant.Status}: {string.Join(", ", tenant.Steps.Select(s => $"{s.Name}:{s.Status}"))}";
            if (now != last) { say?.Invoke(now); last = now; }
            if (!moving) return tenant;
            await Task.Delay(2000);
        }
        Assert.Fail($"{slug} did not settle within {within}: {last}");
        return null!;
    }

    private async Task<T> GetAsync<T>(string path)
    {
        using var response = await _http.GetAsync(path);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, $"GET {path}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private async Task<T> PostAsync<T>(string path, object body, HttpStatusCode expected) => await SendAsync<T>(HttpMethod.Post, path, body, expected);

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, HttpStatusCode expected)
    {
        using var response = await SendRawAsync(method, path, body, expected);
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private async Task SendAsync(HttpMethod method, string path, object? body, HttpStatusCode expected)
        => (await SendRawAsync(method, path, body, expected)).Dispose();

    private async Task<HttpResponseMessage> SendRawAsync(HttpMethod method, string path, object? body, HttpStatusCode expected)
    {
        var response = await _http.SendAsync(new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body, options: Json) });
        Assert.AreEqual(expected, response.StatusCode, $"{method} {path}: {await response.Content.ReadAsStringAsync()}");
        return response;
    }
}
