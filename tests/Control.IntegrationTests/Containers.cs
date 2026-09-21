using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Platform;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;

namespace Ninja.Control.IntegrationTests;

/// <summary>
/// The shared services a stamp needs, real, for the whole assembly: the
/// Postgres the tenants' databases go on, the RabbitMQ the vhosts go on,
/// and a Keycloak the realms go in. The adapters are exercised as they run
/// in production, through <see cref="ProcessShell"/> and the docker CLI on
/// this box (rabbitmqctl, pg_dump and pg_restore run inside the containers),
/// so the containers carry fixed names the adapters can address.
/// </summary>
[TestClass]
public static class Containers
{
    private static readonly string Suffix = Guid.NewGuid().ToString("N")[..8];

    public static readonly string PostgresName = $"ninja-it-postgres-{Suffix}";
    public static readonly string RabbitName = $"ninja-it-rabbit-{Suffix}";

    public const string PostgresPassword = "it-postgres-pw";
    public const string KeycloakAdminPassword = "it-admin-pw";

    public static PostgreSqlContainer Postgres { get; private set; } = null!;
    public static RabbitMqContainer Rabbit { get; private set; } = null!;
    public static IContainer Keycloak { get; private set; } = null!;

    /// <summary>Options that point every adapter at the containers, the way the platform's .env would.</summary>
    public static PlatformOptions Platform { get; private set; } = null!;

    public static IOptions<PlatformOptions> Options => Microsoft.Extensions.Options.Options.Create(Platform);

    public static ProcessShell Shell { get; } = new(NullLogger<ProcessShell>.Instance);

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        Postgres = new PostgreSqlBuilder()
            .WithImage("docker.io/ankane/pgvector:latest")
            .WithName(PostgresName)
            .WithUsername("postgres")
            .WithPassword(PostgresPassword)
            .WithDatabase("postgres")
            .Build();
        Rabbit = new RabbitMqBuilder()
            .WithImage("docker.io/library/rabbitmq:4.2")
            .WithName(RabbitName)
            .WithUsername("guest")
            .WithPassword("guest")
            .Build();
        Keycloak = new ContainerBuilder()
            .WithImage("quay.io/keycloak/keycloak:26.4")
            .WithName($"ninja-it-keycloak-{Suffix}")
            .WithCommand("start-dev")
            .WithEnvironment("KC_BOOTSTRAP_ADMIN_USERNAME", "admin")
            .WithEnvironment("KC_BOOTSTRAP_ADMIN_PASSWORD", KeycloakAdminPassword)
            .WithEnvironment("KC_HEALTH_ENABLED", "true")
            .WithEnvironment("KC_PROXY_HEADERS", "xforwarded")
            .WithPortBinding(8080, assignRandomHostPort: true)
            .WithPortBinding(9000, assignRandomHostPort: true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(9000).ForPath("/health/ready")))
            .Build();

        await Task.WhenAll(Postgres.StartAsync(context.CancellationTokenSource.Token), Rabbit.StartAsync(context.CancellationTokenSource.Token), Keycloak.StartAsync(context.CancellationTokenSource.Token));

        Platform = new PlatformOptions
        {
            Domain = "ninja.test",
            Scheme = "http",
            ControlUrl = "http://control.ninja.test",
            PostgresHost = Postgres.Hostname,
            PostgresPort = Postgres.GetMappedPublicPort(5432),
            PostgresUser = "postgres",
            PostgresPassword = PostgresPassword,
            PostgresContainer = PostgresName,
            RabbitContainer = RabbitName,
            RabbitUser = "guest",
            KeycloakInternalUrl = $"http://{Keycloak.Hostname}:{Keycloak.GetMappedPublicPort(8080)}",
            KeycloakPublicUrl = "http://auth.ninja.test",
            KeycloakAdminUser = "admin",
            KeycloakAdminPassword = KeycloakAdminPassword,
            TenantsRoot = Path.Combine(Path.GetTempPath(), "ninja-it", Suffix),
        };
        Directory.CreateDirectory(Platform.TenantsRoot);
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Task.WhenAll(Postgres.DisposeAsync().AsTask(), Rabbit.DisposeAsync().AsTask(), Keycloak.DisposeAsync().AsTask());
        if (Directory.Exists(Platform.TenantsRoot)) Directory.Delete(Platform.TenantsRoot, recursive: true);
    }
}

/// <summary>A plain client factory: the adapters take one from DI in the app.</summary>
public sealed class PlainHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(new HttpClientHandler { UseCookies = false });
}
