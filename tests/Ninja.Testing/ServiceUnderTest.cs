using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Ninja.Testing;

/// <summary>
/// One service in-process, on the shared Postgres and RabbitMQ: its own
/// database migrated by its own migrations, its own queue on the broker,
/// and a test scheme in place of Keycloak. What a scenario drives is the
/// service's front door, exactly as the apps reach it.
/// </summary>
/// <typeparam name="TProgram">The service's Program, from its own assembly.</typeparam>
public class ServiceUnderTest<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
{
    private readonly string _connectionName;
    private readonly string _database;
    private readonly Dictionary<string, string?> _settings;

    /// <param name="connectionName">What the service calls its database (catalogdb, loyaltydb, …).</param>
    /// <param name="settings">Anything else the service reads at boot.</param>
    public ServiceUnderTest(string connectionName, Dictionary<string, string?>? settings = null)
    {
        _connectionName = connectionName;
        // Its own database on the shared server, so two suites never read each other's rows
        _database = $"{connectionName}_{Guid.NewGuid():N}"[..Math.Min(40, connectionName.Length + 9)];
        _settings = settings ?? [];
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // UseSetting reaches the host configuration before Program.cs reads it; a deferred
        // ConfigureAppConfiguration would arrive after AddNpgsqlDbContext has already looked
        builder.UseSetting($"ConnectionStrings:{_connectionName}", SharedServices.DatabaseFor(_database));
        builder.UseSetting("ConnectionStrings:eventbus", SharedServices.RabbitConnectionString);
        // One queue per suite on the shared broker: a service under test reads only its own events
        builder.UseSetting("EventBus:SubscriptionClientName", _database);
        // A realm URL so the shared policies (Admin, Owner, Pos) are registered at all — with no URL the
        // services register authentication and stop. Nothing is ever fetched from it: the test scheme below
        // is the default, so the bearer handler is never asked for its metadata
        builder.UseSetting("Identity:Url", "https://auth.ninja.test/realms/ninja");
        foreach (var (key, value) in _settings) builder.UseSetting(key, value);

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(TestAuth.Scheme).AddScheme<AuthenticationSchemeOptions, TestAuth>(TestAuth.Scheme, _ => { });
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultAuthenticateScheme = TestAuth.Scheme;
                o.DefaultChallengeScheme = TestAuth.Scheme;
            });
            ConfigureServices(services);
        });
    }

    /// <summary>A suite's own doubles, if it needs any.</summary>
    protected virtual void ConfigureServices(IServiceCollection services) { }

    /// <summary>The service as this person, with the branch they are working in named on every request.</summary>
    public Caller As(Persona persona, int? branch = null)
    {
        var client = CreateClient();
        foreach (var (key, value) in persona.Headers()) client.DefaultRequestHeaders.Add(key, value);
        if (branch is { } id) client.DefaultRequestHeaders.Add("X-Branch-Id", id.ToString());
        return new Caller(client);
    }

    /// <summary>The service as nobody: the requests that must be refused before anything else.</summary>
    public Caller AsAnonymous() => new(CreateClient());

    /// <summary>Something the service does in the background has happened; asked for again until it has.</summary>
    public static async Task EventuallyAsync(Func<Task<bool>> condition, string because, int seconds = 20)
    {
        var clock = Stopwatch.StartNew();
        while (clock.Elapsed < TimeSpan.FromSeconds(seconds))
        {
            if (await condition()) return;
            await Task.Delay(200);
        }
        Assert.Fail($"Still not true after {seconds}s: {because}");
    }
}

/// <summary>The service's front door, as one person knocking on it.</summary>
public sealed class Caller(HttpClient http)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    public HttpClient Http => http;

    public Task<T> GetAsync<T>(string path) => SendAsync<T>(HttpMethod.Get, path, null, HttpStatusCode.OK);
    public Task<T> PostAsync<T>(string path, object? body = null, HttpStatusCode expected = HttpStatusCode.OK) => SendAsync<T>(HttpMethod.Post, path, body, expected);
    public Task<T> PutAsync<T>(string path, object? body = null) => SendAsync<T>(HttpMethod.Put, path, body, HttpStatusCode.OK);

    public async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, HttpStatusCode expected)
    {
        using var response = await RawAsync(method, path, body);
        Assert.AreEqual(expected, response.StatusCode, $"{method} {path}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    /// <summary>The answer as it came, for a refusal or anything that is not JSON.</summary>
    public Task<HttpResponseMessage> RawAsync(HttpMethod method, string path, object? body = null)
        => http.SendAsync(new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body, options: Json) });

    /// <summary>A refusal and how the service phrased it.</summary>
    public async Task<(HttpStatusCode Status, string Detail)> RefusedAsync(HttpMethod method, string path, object? body = null)
    {
        using var response = await RawAsync(method, path, body);
        var text = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(text)) return (response.StatusCode, "");
        try
        {
            var problem = JsonSerializer.Deserialize<JsonElement>(text, Json);
            return (response.StatusCode, problem.ValueKind == JsonValueKind.Object && problem.TryGetProperty("detail", out var d) ? d.GetString() ?? "" : text);
        }
        catch (JsonException)
        {
            return (response.StatusCode, text);
        }
    }
}
