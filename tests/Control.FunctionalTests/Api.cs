using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>
/// The control API the way the control app calls it, with the answers as
/// the API's own records. Every call asserts the status it expects, so a
/// scenario reads as the story and not as HTTP.
/// </summary>
public sealed class Api
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly HttpClient _http = ControlPlane.Factory.CreateClient();

    public static Api AsPlatformAdmin() => new();

    /// <summary>The same client with nobody signed in.</summary>
    public HttpClient Anonymous()
    {
        var client = ControlPlane.Factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuth.AnonymousHeader, "1");
        return client;
    }

    /// <summary>A slug nobody else in the run uses: the prefix and eight hex characters, within the platform's naming rules.</summary>
    public static string Slug(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..(prefix.Length + 9)];

    /// <summary>Force: the dry-run box is a 16 GB machine, and one run stamps more stacks than fit on it.</summary>
    public async Task<TenantDetail> CreateAsync(string slug, TenantKind kind = TenantKind.Demo, TenantPlan plan = TenantPlan.Free, bool provision = false, Module[]? addons = null)
        => await PostAsync<TenantDetail>("/api/control/tenants", new CreateTenantRequest(
            NameEn: $"Café {slug}", NameAr: null, OwnerEmail: $"owner@{slug}.test", Kind: kind, Slug: slug, Plan: plan, Provision: provision, Force: true, Addons: addons), HttpStatusCode.Created);

    public Task<TenantDetail> TenantAsync(string slug) => GetAsync<TenantDetail>($"/api/control/tenants/{slug}");

    public Task<SubscriptionDetail> SubscriptionAsync(string slug) => GetAsync<SubscriptionDetail>($"/api/control/tenants/{slug}/subscription");

    public Task<SubscriptionDetail> SetSubscriptionAsync(string slug, TenantPlan plan, Module[]? addons = null, int? graceDays = null)
        => PutAsync<SubscriptionDetail>($"/api/control/tenants/{slug}/subscription", new UpdateSubscriptionRequest(plan, addons, graceDays));

    public Task<TenantDetail> ConvertAsync(string slug, TenantPlan? plan = null, Module[]? addons = null)
        => PostAsync<TenantDetail>($"/api/control/tenants/{slug}/convert", new ConvertRequest(plan, addons), HttpStatusCode.OK);

    public Task ProvisionAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/provision");
    public Task StopAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/stop");
    public Task StartAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/start");
    public Task UpgradeAsync(string slug, string? imageTag = null) => AcceptedAsync($"/api/control/tenants/{slug}/upgrade", new UpgradeRequest(imageTag));
    public Task DestroyAsync(string slug) => ExpectAsync(_http.DeleteAsync($"/api/control/tenants/{slug}"), HttpStatusCode.Accepted);

    public async Task<List<AuditEntry>> AuditAsync(string slug) => await GetAsync<List<AuditEntry>>($"/api/control/audit?slug={slug}&take=200");

    public Task<TenantDetail> UpdateAsync(string slug, UpdateTenantRequest record) => PutAsync<TenantDetail>($"/api/control/tenants/{slug}", record);
    public Task<TenantDetail> ExtendAsync(string slug, int days) => PostAsync<TenantDetail>($"/api/control/tenants/{slug}/extend", new ExtendRequest(days), HttpStatusCode.OK);
    public Task<SubscriptionDetail> RecordPaymentAsync(string slug, decimal amount, DateTimeOffset periodEnd, string currency = "EGP", string? reference = null)
        => PostAsync<SubscriptionDetail>($"/api/control/tenants/{slug}/subscription/payments", new RecordPaymentRequest(amount, currency, periodEnd, null, reference), HttpStatusCode.Created);
    public Task SuspendAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/subscription/suspend");
    public Task ResumeAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/subscription/resume");
    public Task RollbackAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/rollback");
    public Task SecureAsync(string slug, bool rotate) => AcceptedAsync($"/api/control/tenants/{slug}/secure?rotate={(rotate ? "true" : "false")}");
    public Task BackupAsync(string slug) => AcceptedAsync($"/api/control/tenants/{slug}/backups");
    public Task<List<BackupInfo>> BackupsAsync(string slug) => GetAsync<List<BackupInfo>>($"/api/control/tenants/{slug}/backups");
    public Task<TenantDetail> RestoreAsync(string slug, string id, string into) => PostAsync<TenantDetail>($"/api/control/tenants/{slug}/backups/{id}/restore", new RestoreRequest(into, Force: true), HttpStatusCode.Created);
    public Task<QueueResponse> JobsAsync() => GetAsync<QueueResponse>("/api/control/platform/jobs?take=200");
    public Task<PlatformResponse> PlatformAsync() => GetAsync<PlatformResponse>("/api/control/platform");
    /// <summary>The box read now, not the last snapshot the monitor took.</summary>
    public Task<CapacityResponse> CapacityAsync() => GetAsync<CapacityResponse>("/api/control/platform/capacity?refresh=true");
    public Task<PlanCatalogResponse> PlansAsync() => GetAsync<PlanCatalogResponse>("/api/control/platform/plans");
    public Task<UpdatesResponse> UpdatesAsync() => GetAsync<UpdatesResponse>("/api/control/platform/updates");
    public Task<FleetUpgradeResponse> FleetUpgradeAsync(string tag, string? canary, params string[] slugs)
        => PostAsync<FleetUpgradeResponse>("/api/control/platform/upgrade", new FleetUpgradeRequest(tag, canary, slugs.Length == 0 ? null : slugs), HttpStatusCode.Accepted);
    public Task<List<TenantSummary>> ListAsync() => GetAsync<List<TenantSummary>>("/api/control/tenants");
    public Task<ImpersonationLink> ImpersonateAsync(string slug) => PostAsync<ImpersonationLink>($"/api/control/tenants/{slug}/impersonate", new { }, HttpStatusCode.OK);
    public Task<MailStatusResponse> MailAsync() => GetAsync<MailStatusResponse>("/api/control/platform/mail");
    public Task<List<ServiceHealth>> HealthAsync(string slug) => GetAsync<List<ServiceHealth>>($"/api/control/tenants/{slug}/health");
    public Task<BrandDto> BrandAsync(string slug) => GetAsync<BrandDto>($"/api/control/tenants/{slug}/brand");
    public Task<BrandDto> SetBrandAsync(string slug, UpdateBrandRequest brand) => PutAsync<BrandDto>($"/api/control/tenants/{slug}/brand", brand);

    /// <summary>A raw response, for the endpoints that answer with a file, a redirect or plain text.</summary>
    public Task<HttpResponseMessage> RawAsync(HttpMethod method, string path, HttpContent? content = null)
        => _http.SendAsync(new HttpRequestMessage(method, path) { Content = content });

    /// <summary>A client that does not follow redirects, for the links the API hands out.</summary>
    public static HttpClient NoRedirects() => ControlPlane.Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    /// <summary>The same moment: a timestamptz keeps microseconds, a DateTimeOffset in memory keeps ticks.</summary>
    public static void AssertSameInstant(DateTimeOffset? expected, DateTimeOffset? actual, string because)
        => Assert.IsTrue(expected.HasValue == actual.HasValue && (!expected.HasValue || (expected.Value - actual!.Value).Duration() < TimeSpan.FromMilliseconds(1)),
            $"{because}: expected {expected:O}, got {actual:O}");

    /// <summary>What the dry run stamped as the tenant's .env.</summary>
    public static string EnvOnDisk(string slug) => File.ReadAllText(Path.Combine(ControlPlane.TenantsRoot, slug, ".env"));

    /// <summary>A refusal, as the API phrases it.</summary>
    public async Task<(HttpStatusCode Status, string Detail)> RefusedAsync(HttpMethod method, string path, object? payload = null)
    {
        using var request = new HttpRequestMessage(method, path) { Content = payload is null ? null : JsonContent.Create(payload, options: Json) };
        using var response = await _http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(body)) return (response.StatusCode, "");
        var problem = JsonSerializer.Deserialize<JsonElement>(body, Json);
        return (response.StatusCode, problem.ValueKind == JsonValueKind.Object && problem.TryGetProperty("detail", out var d) ? d.GetString() ?? "" : "");
    }

    /// <summary>
    /// The stamp lane has done everything it was asked for this tenant:
    /// no job open and no transitional status. The workers poll every 15 s
    /// when nothing signals them, so a scenario allows for that.
    /// </summary>
    public async Task<TenantDetail> SettledAsync(string slug, TimeSpan? within = null)
    {
        var deadline = Stopwatch.StartNew();
        var limit = within ?? TimeSpan.FromSeconds(60);
        TenantDetail last;
        do
        {
            last = await TenantAsync(slug);
            var moving = last.Jobs.Count > 0 || last.Status is TenantStatus.Provisioning or TenantStatus.Upgrading or TenantStatus.Destroying;
            if (!moving) return last;
            await Task.Delay(250);
        } while (deadline.Elapsed < limit);
        Assert.Fail($"{slug} did not settle within {limit}: status {last.Status}, jobs {string.Join(", ", last.Jobs.Select(j => $"{j.Action}:{j.Status}"))}, error {last.LastError}");
        return last;
    }

    /// <summary>What the dry run stamped for this tenant.</summary>
    public static string ComposeOnDisk(string slug) => File.ReadAllText(Path.Combine(ControlPlane.TenantsRoot, slug, "docker-compose.yaml"));

    public static bool HasStack(string slug) => File.Exists(Path.Combine(ControlPlane.TenantsRoot, slug, "docker-compose.yaml"));

    private async Task<T> GetAsync<T>(string path)
    {
        using var response = await _http.GetAsync(path);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, $"GET {path}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private async Task<T> PostAsync<T>(string path, object body, HttpStatusCode expected)
    {
        using var response = await _http.PostAsJsonAsync(path, body, Json);
        Assert.AreEqual(expected, response.StatusCode, $"POST {path}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private async Task<T> PutAsync<T>(string path, object body)
    {
        using var response = await _http.PutAsJsonAsync(path, body, Json);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, $"PUT {path}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private Task AcceptedAsync(string path, object? body = null)
        => ExpectAsync(body is null ? _http.PostAsync(path, null) : _http.PostAsJsonAsync(path, body, Json), HttpStatusCode.Accepted);

    private static async Task ExpectAsync(Task<HttpResponseMessage> call, HttpStatusCode expected)
    {
        using var response = await call;
        Assert.AreEqual(expected, response.StatusCode, $"{response.RequestMessage?.Method} {response.RequestMessage?.RequestUri?.PathAndQuery}: {await response.Content.ReadAsStringAsync()}");
    }
}
