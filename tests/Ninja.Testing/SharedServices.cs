using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;

namespace Ninja.Testing;

/// <summary>
/// The shared services a café's stack runs on, once for a test assembly: a
/// Postgres the service migrates its own database into, and a RabbitMQ it
/// publishes and subscribes on. A suite starts them from its
/// <c>[AssemblyInitialize]</c> and stops them from its cleanup.
/// </summary>
public static class SharedServices
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static PostgreSqlContainer? _postgres;
    private static RabbitMqContainer? _rabbit;

    public static string PostgresConnectionString { get; private set; } = "";
    public static string RabbitConnectionString { get; private set; } = "";

    /// <summary>Both containers, up and ready; the second caller waits for the first.</summary>
    public static async Task StartAsync()
    {
        await Gate.WaitAsync();
        try
        {
            if (_postgres is not null) return;
            var suffix = Guid.NewGuid().ToString("N")[..8];
            var postgres = new PostgreSqlBuilder()
                .WithImage("docker.io/ankane/pgvector:latest")
                .WithName($"ninja-ft-postgres-{suffix}")
                .WithUsername("postgres")
                .WithPassword("ft-postgres-pw")
                .WithDatabase("postgres")
                .Build();
            var rabbit = new RabbitMqBuilder()
                .WithImage("docker.io/library/rabbitmq:4.2")
                .WithName($"ninja-ft-rabbit-{suffix}")
                .WithUsername("guest")
                .WithPassword("guest")
                .Build();
            await Task.WhenAll(postgres.StartAsync(), rabbit.StartAsync());
            _postgres = postgres;
            _rabbit = rabbit;
            PostgresConnectionString = postgres.GetConnectionString();
            RabbitConnectionString = rabbit.GetConnectionString();
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task StopAsync()
    {
        if (_postgres is not null) await _postgres.DisposeAsync();
        if (_rabbit is not null) await _rabbit.DisposeAsync();
        _postgres = null;
        _rabbit = null;
    }

    /// <summary>The same Postgres, one database per service under test: its own migrations run in it.</summary>
    public static string DatabaseFor(string name)
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(PostgresConnectionString) { Database = name };
        return builder.ConnectionString;
    }
}
