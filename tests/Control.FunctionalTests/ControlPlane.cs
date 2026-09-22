using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Platform;
using Testcontainers.PostgreSql;

namespace Ninja.Control.FunctionalTests;

/// <summary>
/// One control plane for the whole assembly: Control.API in-process on a
/// dry-run box, over a controldb the migrations create in a Postgres
/// container. Every scenario stamps its own slug, so they share the plane
/// the way admins share the real one.
/// </summary>
[TestClass]
public static class ControlPlane
{
    private static readonly string Suffix = Guid.NewGuid().ToString("N")[..8];

    public static PostgreSqlContainer Postgres { get; private set; } = null!;
    public static ControlApiFactory Factory { get; private set; } = null!;

    /// <summary>Where the dry-run stacks are stamped: the compose and .env each scenario reads back.</summary>
    public static string TenantsRoot { get; } = Path.Combine(Path.GetTempPath(), "ninja-functional-tests", Suffix);

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        Postgres = new PostgreSqlBuilder()
            .WithImage("docker.io/ankane/pgvector:latest")
            .WithName($"ninja-ft-postgres-{Suffix}")
            .WithUsername("postgres")
            .WithPassword("ft-postgres-pw")
            .WithDatabase("controldb")
            .Build();
        await Postgres.StartAsync();
        Directory.CreateDirectory(TenantsRoot);
        Factory = new ControlApiFactory(Postgres.GetConnectionString(), TenantsRoot);
        // Boot now, so the migrations and the workers are up before the first scenario asks anything
        _ = Factory.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Factory.DisposeAsync();
        await Postgres.DisposeAsync();
        if (Directory.Exists(TenantsRoot)) Directory.Delete(TenantsRoot, recursive: true);
    }
}

/// <summary>
/// Control.API as the tests run it: DryRun on (every adapter is the
/// recording double the app itself registers for a dry run), the tenants
/// root in a temp folder, no Keycloak (a test scheme signs every request in
/// as a platform admin), and the box's fixed names for the audit to carry.
/// </summary>
public sealed class ControlApiFactory(string controlDb, string tenantsRoot) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // UseSetting lands in the host configuration before Program.cs runs; a deferred ConfigureAppConfiguration would
        // arrive after AddNpgsqlDbContext has already read the connection string
        foreach (var (key, value) in new Dictionary<string, string?>
        {
            ["ConnectionStrings:controldb"] = controlDb,
            ["Platform:DryRun"] = "true",
            ["Platform:TenantsRoot"] = tenantsRoot,
            ["Platform:Domain"] = "ninja.test",
            ["Platform:ControlUrl"] = "https://control.ninja.test",
            ["Platform:KeycloakPublicUrl"] = "https://auth.ninja.test",
            ["Platform:ImageRegistry"] = "ghcr.io/achmstein/ninja",
            ["Platform:DefaultImageTag"] = "v1",
            ["Platform:PullImages"] = "false",
            // No Identity:Url: the app registers authentication with no scheme, and the test scheme below is the default
            ["Identity:Url"] = null,
        }) builder.UseSetting(key, value);
        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(TestAuth.Scheme).AddScheme<AuthenticationSchemeOptions, TestAuth>(TestAuth.Scheme, _ => { });
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultAuthenticateScheme = TestAuth.Scheme;
                o.DefaultChallengeScheme = TestAuth.Scheme;
            });
        });
    }

    /// <summary>The box as the dry run recorded it: every docker, pg_dump and rabbitmqctl the plane would have run.</summary>
    public RecordingShell Shell => Services.GetRequiredService<RecordingShell>();

    /// <summary>The broker as the dry run recorded it: the queues dropped when a module left a plan.</summary>
    public DryRunBrokerAdmin Broker => (DryRunBrokerAdmin)Services.GetRequiredService<IBrokerAdmin>();

    public PlatformOptions Platform => Services.GetRequiredService<IOptions<PlatformOptions>>().Value;
}

/// <summary>
/// Every request is a signed-in platform admin, the way control-web's
/// token would read; a request carrying <see cref="AnonymousHeader"/> is
/// nobody, for the scenarios that check the door is locked.
/// </summary>
public sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "Test";
    public const string AnonymousHeader = "X-Test-Anonymous";
    public const string UserId = "00000000-0000-4000-8000-000000000001";
    public const string Email = "admin@ninja.test";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Headers.ContainsKey(AnonymousHeader)) return Task.FromResult(AuthenticateResult.NoResult());
        // The claim names Keycloak's tokens carry, and the role type the platform's JWT options read
        var identity = new ClaimsIdentity(
        [
            new Claim("sub", UserId),
            new Claim("email", Email),
            new Claim("preferred_username", "platform"),
            new Claim("role", "PlatformAdmin"),
        ], Scheme, nameType: "preferred_username", roleType: "role");
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
    }
}
