using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>The six images a brand is made of, named as the stack names them.</summary>
public static class BrandImageSlots
{
    public static readonly string[] All = ["logo", "logo-dark", "wordmark-en", "wordmark-en-dark", "wordmark-ar", "wordmark-ar-dark"];

    public static bool IsKnown(string slot) => Array.IndexOf(All, slot) >= 0;
}

/// <summary>How a request to a stack signs itself: not at all, or as the platform's service account in the tenant's realm.</summary>
public enum StackAuth
{
    Anonymous,
    Control,
}

/// <summary>
/// The control plane's way into a tenant's stack: its gateway on the shared
/// network, reached by the container name, signed as <c>ninja-control</c>
/// when the call needs the owner's rights.
/// </summary>
public interface IStackProxy
{
    Task<HttpResponseMessage> SendAsync(Tenant tenant, HttpMethod method, string pathAndQuery, HttpContent? content, StackAuth auth, CancellationToken ct, int? branchId = null);
}

/// <summary>A client-credentials token for <c>ninja-control</c> in the tenant's realm, cached until shortly before it expires.</summary>
public interface IStackTokenProvider
{
    Task<string> GetAsync(Tenant tenant, CancellationToken ct);

    /// <summary>Forget a token the stack refused; the next call fetches a fresh one.</summary>
    void Invalidate(string slug);
}

public sealed class KeycloakStackTokenProvider(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options) : IStackTokenProvider
{
    private static readonly TimeSpan Margin = TimeSpan.FromSeconds(30);
    private readonly ConcurrentDictionary<string, (string Token, DateTimeOffset ExpiresAt)> _tokens = new();

    public async Task<string> GetAsync(Tenant tenant, CancellationToken ct)
    {
        if (_tokens.TryGetValue(tenant.Slug, out var cached) && cached.ExpiresAt - Margin > DateTimeOffset.UtcNow)
            return cached.Token;

        var client = httpClientFactory.CreateClient("keycloak");
        var realm = TenantNaming.Realm(tenant.Slug);
        var response = await client.PostAsync($"{options.Value.KeycloakInternalUrl.TrimEnd('/')}/realms/{realm}/protocol/openid-connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = "ninja-control",
            ["client_secret"] = tenant.ControlSecret,
        }), ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak refused the control token for {realm} ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");

        var body = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!;
        var token = body["access_token"]!.GetValue<string>();
        var expiresIn = body["expires_in"]?.GetValue<int>() ?? 60;
        _tokens[tenant.Slug] = (token, DateTimeOffset.UtcNow.AddSeconds(expiresIn));
        return token;
    }

    public void Invalidate(string slug) => _tokens.TryRemove(slug, out _);
}

public sealed class HttpStackProxy(IHttpClientFactory httpClientFactory, IStackTokenProvider tokens) : IStackProxy
{
    public async Task<HttpResponseMessage> SendAsync(Tenant tenant, HttpMethod method, string pathAndQuery, HttpContent? content, StackAuth auth, CancellationToken ct, int? branchId = null)
    {
        var response = await SendOnceAsync(tenant, method, pathAndQuery, content, auth, branchId, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized && auth == StackAuth.Control)
        {
            // A token the stack no longer takes (a realm re-created under the same slug): once more with a fresh one
            response.Dispose();
            tokens.Invalidate(tenant.Slug);
            response = await SendOnceAsync(tenant, method, pathAndQuery, content, auth, branchId, ct);
        }
        return response;
    }

    private async Task<HttpResponseMessage> SendOnceAsync(Tenant tenant, HttpMethod method, string pathAndQuery, HttpContent? content, StackAuth auth, int? branchId, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("stack");
        using var request = new HttpRequestMessage(method, $"http://{TenantNaming.Gateway(tenant.Slug)}:5000{pathAndQuery}") { Content = content };
        if (auth == StackAuth.Control)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetAsync(tenant, ct));
        if (branchId is int branch)
            request.Headers.Add("X-Branch-Id", branch.ToString());
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
    }
}

/// <summary>
/// Dry run: answers as a stack would, from what the control plane itself
/// knows. The brand is kept per slug so the control app can read back what
/// it wrote; every image is absent; every service is healthy.
/// </summary>
public sealed class DryRunStackProxy(IOptions<PlatformOptions> options) : IStackProxy
{
    public ConcurrentDictionary<string, JsonObject> Brands { get; } = new();

    public JsonObject BrandOf(Tenant tenant)
        => Brands.GetOrAdd(tenant.Slug, _ => NeutralBrand(tenant, TenantHosts.For(tenant, options.Value)));

    public async Task<HttpResponseMessage> SendAsync(Tenant tenant, HttpMethod method, string pathAndQuery, HttpContent? content, StackAuth auth, CancellationToken ct, int? branchId = null)
    {
        var path = pathAndQuery.Split('?')[0];
        if (path.StartsWith("/health/", StringComparison.Ordinal))
            return new(HttpStatusCode.OK) { Content = new StringContent("Healthy") };

        if (path == "/api/tenant")
        {
            var brand = BrandOf(tenant);
            if (method == HttpMethod.Put && content is not null)
            {
                // What the stack would keep of the request; the images and icons are its own
                var update = await content.ReadFromJsonAsync<JsonObject>(ct);
                foreach (var key in new[] { "name", "primaryColor", "customerUrl", "features", "theme", "locale" })
                {
                    if (update?[key] is { } value)
                        brand[key] = value.DeepClone();
                }
                brand["version"] = DateTimeOffset.UtcNow.UtcTicks;
            }
            return Json(brand);
        }

        if (path.StartsWith("/api/tenant/images/", StringComparison.Ordinal))
            return method == HttpMethod.Get ? new(HttpStatusCode.NotFound) : Json(BrandOf(tenant));

        // The café's figures, as its services would report them: steady numbers seeded by the slug
        var seed = tenant.Slug.Aggregate(17, (h, c) => h * 31 + c) & 0x7fffffff;
        switch (path)
        {
            case "/api/branches/all":
                return Json(new JsonArray(new JsonObject { ["id"] = 1, ["name"] = new JsonObject { ["en"] = "Main", ["ar"] = "الرئيسي" }, ["isActive"] = true }));
            case "/api/orders/stats":
            {
                var query = System.Web.HttpUtility.ParseQueryString(pathAndQuery.Contains('?') ? pathAndQuery[(pathAndQuery.IndexOf('?') + 1)..] : "");
                var from = DateTime.TryParse(query["fromDate"], null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var f) ? f.Date : DateTime.UtcNow.Date.AddDays(-6);
                var to = DateTime.TryParse(query["toDate"], null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var t) ? t.Date : DateTime.UtcNow.Date;
                var days = new JsonArray();
                for (var day = from; day <= to; day = day.AddDays(1))
                {
                    var n = 12 + (seed + day.DayOfYear) % 23;
                    days.Add(new JsonObject { ["date"] = day.ToString("yyyy-MM-dd"), ["orders"] = n, ["revenue"] = n * 85.5 });
                }
                return Json(new JsonObject
                {
                    ["days"] = days,
                    ["topItems"] = new JsonArray(
                        new JsonObject { ["productName"] = new JsonObject { ["en"] = "Latte", ["ar"] = "لاتيه" }, ["units"] = 40 + seed % 30, ["revenue"] = (40 + seed % 30) * 50.0 },
                        new JsonObject { ["productName"] = new JsonObject { ["en"] = "Tea", ["ar"] = "شاي" }, ["units"] = 25 + seed % 20, ["revenue"] = (25 + seed % 20) * 20.0 }),
                });
            }
            case "/api/tickets/reports/range":
                return Json(new JsonObject { ["ticketsSettled"] = 60 + seed % 40, ["net"] = 5400.25 + seed % 900 });
            case "/api/finance/profit":
                return Json(new JsonObject { ["netSales"] = 21000 + seed % 5000, ["profit"] = 6400 + seed % 1500 });
            case "/api/loyalty/stats":
                return Json(new JsonObject { ["totalAccounts"] = 120 + seed % 200 });
        }

        return new(HttpStatusCode.NotFound) { Content = new StringContent($"(dry run) nothing answers {method} {path}") };
    }

    private static HttpResponseMessage Json(JsonNode body)
        => new(HttpStatusCode.OK) { Content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json") };

    /// <summary>What a stack answers before anyone has branded it: the seed values, no images, every switch on.</summary>
    public static JsonObject NeutralBrand(Tenant tenant, TenantHosts hosts) => new()
    {
        ["name"] = new JsonObject { ["en"] = tenant.NameEn, ["ar"] = tenant.NameAr },
        ["primaryColor"] = tenant.PrimaryColor,
        ["customerUrl"] = hosts.CustomerUrl,
        ["auth"] = null,
        ["logoUrl"] = null,
        ["logoDarkUrl"] = null,
        ["wordmarks"] = new JsonObject { ["en"] = null, ["enDark"] = null, ["ar"] = null, ["arDark"] = null },
        ["theme"] = new JsonObject { ["accent"] = null, ["surface"] = null, ["radius"] = null, ["fontLatin"] = null, ["fontArabic"] = null, ["dark"] = null },
        ["icons"] = new JsonObject
        {
            ["icon192"] = "/api/tenant/icons/icon-192.png?v=0",
            ["icon512"] = "/api/tenant/icons/icon-512.png?v=0",
            ["maskable512"] = "/api/tenant/icons/maskable-512.png?v=0",
            ["appleTouch"] = "/api/tenant/icons/apple-touch-icon.png?v=0",
            ["favicon"] = "/api/tenant/icons/favicon.png?v=0",
        },
        ["features"] = new JsonObject
        {
            ["rooms"] = true, ["loyalty"] = true, ["tabs"] = true, ["inventory"] = true,
            ["finance"] = true, ["payroll"] = true, ["kds"] = true,
        },
        ["locale"] = new JsonObject
        {
            ["country"] = tenant.Country, ["currency"] = tenant.Currency, ["timeZone"] = tenant.TimeZone, ["language"] = tenant.DefaultLanguage,
        },
        ["version"] = 0,
    };
}
