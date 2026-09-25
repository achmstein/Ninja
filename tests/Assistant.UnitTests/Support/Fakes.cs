using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Assistant.API;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.UnitTests.Support;

/// <summary>One request as the fake saw it, body read before the client disposed it.</summary>
public sealed record SeenRequest(HttpMethod Method, Uri Url, string? Branch, string? RequestId, string? Bearer, string? Body);

/// <summary>Answers by URL host + path, records every request.</summary>
public sealed class FakeHandler : HttpMessageHandler
{
    private readonly List<(Func<HttpRequestMessage, bool> Match, Func<HttpRequestMessage, HttpResponseMessage> Respond)> _routes = [];

    public List<SeenRequest> Requests { get; } = [];

    public FakeHandler On(string method, string hostAndPathPrefix, Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        _routes.Add((r => r.Method.Method == method && $"{r.RequestUri!.Host}{r.RequestUri.AbsolutePath}".StartsWith(hostAndPathPrefix, StringComparison.Ordinal), respond));
        return this;
    }

    public FakeHandler OnJson(string method, string hostAndPathPrefix, Func<HttpRequestMessage, object> payload)
        => On(method, hostAndPathPrefix, r => Json(payload(r)));

    public static HttpResponseMessage Json(object payload, HttpStatusCode status = HttpStatusCode.OK)
        => new(status) { Content = JsonContent.Create(payload, options: new JsonSerializerOptions(JsonSerializerDefaults.Web)) };

    public static HttpResponseMessage Text(string text, HttpStatusCode status)
        => new(status) { Content = new StringContent(text, System.Text.Encoding.UTF8, "application/json") };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        Requests.Add(new SeenRequest(
            request.Method,
            request.RequestUri!,
            request.Headers.TryGetValues(NinjaApiClient.BranchHeader, out var b) ? b.First() : null,
            request.Headers.TryGetValues(NinjaApiClient.RequestIdHeader, out var id) ? id.First() : null,
            request.Headers.Authorization?.Parameter,
            body));
        foreach (var (match, respond) in _routes)
            if (match(request)) return respond(request);
        return Text($"no fake route for {request.Method} {request.RequestUri}", HttpStatusCode.NotFound);
    }
}

public sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}

/// <summary>A clock the tests move by hand.</summary>
public sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

/// <summary>The pieces a tool needs, wired over one fake handler.</summary>
public sealed class Bench
{
    public FakeHandler Handler { get; } = new();
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero));
    public IMemoryCache Cache { get; } = new MemoryCache(new MemoryCacheOptions());
    public HttpContextAccessor Accessor { get; } = new();
    public AssistantOptions Options { get; }
    public TokenExchanger Tokens { get; }
    public NinjaApiClient Api { get; }
    public TenantContext Tenant { get; }
    public AuditLog Audit { get; } = new(NullLogger<AuditLog>.Instance);

    public const string InboundToken = "inbound.token.value";

    public Bench(bool exchange = false)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = $"Bearer {InboundToken}";
        context.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity([new("sub", "owner-1"), new("name", "Owner One")], "test"));
        Accessor.HttpContext = context;

        Options = new AssistantOptions
        {
            PublicUrl = "http://localhost:5000/mcp",
            Issuer = "http://localhost:8080/realms/chillax",
            TokenExchange = new TokenExchangeOptions { Enabled = exchange, ClientId = "assistant-api", ClientSecret = "s3cret" },
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Identity:Url"] = "http://keycloak:8080/realms/chillax" })
            .Build();
        var factory = new FakeHttpClientFactory(Handler);
        Tokens = new TokenExchanger(factory, Cache, Microsoft.Extensions.Options.Options.Create(Options), configuration, Accessor, Clock, NullLogger<TokenExchanger>.Instance);
        Api = new NinjaApiClient(factory, Tokens);
        Tenant = new TenantContext(Api, Cache);
    }

    /// <summary>Two branches: Nasr City (day starts 17:00) and Maadi (midnight), Cairo, pounds.</summary>
    public Bench WithTenant()
    {
        Handler.OnJson("GET", "tenant-api/api/branches/all", _ => new object[]
        {
            new { id = 1, name = new { en = "Nasr City", ar = "مدينة نصر" }, isActive = true, displayOrder = 1, dayStartTime = "17:00", dayEndTime = "05:00", isOrderingEnabled = true, isReservationsEnabled = true },
            new { id = 2, name = new { en = "Maadi", ar = "المعادي" }, isActive = true, displayOrder = 2, dayStartTime = "00:00", dayEndTime = "23:59", isOrderingEnabled = false, isReservationsEnabled = true },
            new { id = 3, name = new { en = "Old Zamalek", ar = "الزمالك" }, isActive = false, displayOrder = 3, dayStartTime = "00:00", dayEndTime = "23:59", isOrderingEnabled = false, isReservationsEnabled = false },
        });
        Handler.OnJson("GET", "tenant-api/api/tenant", _ => new
        {
            name = new { en = "Chillax", ar = "تشيلاكس" },
            locale = new { country = "EG", currency = "EGP", timeZone = "Africa/Cairo", language = "ar" },
        });
        return this;
    }

    public static string TextOf(ModelContextProtocol.Protocol.CallToolResult result)
        => ((ModelContextProtocol.Protocol.TextContentBlock)result.Content[0]).Text;

    public static JsonElement JsonOf(ModelContextProtocol.Protocol.CallToolResult result)
        => JsonDocument.Parse(TextOf(result)).RootElement;
}
