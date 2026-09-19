using System.Text.Json.Serialization;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<ControlContext>("controldb", configureDbContextOptions: options =>
        {
            options.UseNpgsql(builder => builder.MigrationsAssembly(typeof(ControlContext).Assembly.FullName));
        });
        builder.Services.AddMigration<ControlContext>();

        builder.Services.Configure<PlatformOptions>(builder.Configuration.GetSection(PlatformOptions.Section));

        // Kinds and statuses travel as their names, not their numbers
        builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        // No cookie jar: the impersonation call's Set-Cookie headers are read off the response and handed to a browser
        builder.Services.AddHttpClient("keycloak").ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { UseCookies = false });
        builder.Services.AddSingleton<ImpersonationTickets>();
        builder.Services.AddHttpClient("stack", client => client.Timeout = TimeSpan.FromSeconds(30));

        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<IAuditWriter, AuditWriter>();
        builder.Services.AddSingleton<ProvisioningQueue>();
        builder.Services.AddScoped<Provisioner>();
        builder.Services.AddHostedService<ProvisioningWorker>();
        builder.Services.AddHostedService<DemoExpiryService>();
        builder.Services.AddSingleton<CapacityCache>();
        builder.Services.AddHostedService<CapacityMonitor>();
        builder.Services.AddSingleton<TenantOps>();
        builder.Services.AddSingleton<TenantMetricsCollector>();
        builder.Services.AddSingleton<BackupService>();
        builder.Services.AddHostedService<NightlyBackupService>();

        var dryRun = builder.Configuration.GetValue<bool>($"{PlatformOptions.Section}:DryRun");
        if (dryRun)
        {
            // Dev and tests: every step runs and is recorded, nothing on the box is touched
            builder.Services.AddSingleton<RecordingShell>();
            builder.Services.AddSingleton<IShell>(sp => sp.GetRequiredService<RecordingShell>());
            builder.Services.AddSingleton<DryRunDatabaseAdmin>();
            builder.Services.AddSingleton<IDatabaseAdmin>(sp => sp.GetRequiredService<DryRunDatabaseAdmin>());
            builder.Services.AddSingleton<IBrokerAdmin, DryRunBrokerAdmin>();
            builder.Services.AddSingleton<DryRunKeycloakAdmin>();
            builder.Services.AddSingleton<IKeycloakAdmin>(sp => sp.GetRequiredService<DryRunKeycloakAdmin>());
            builder.Services.AddSingleton<DryRunStackProxy>();
            builder.Services.AddSingleton<IStackProxy>(sp => sp.GetRequiredService<DryRunStackProxy>());
            builder.Services.AddSingleton<ITenantStack, DryRunTenantStack>();
            builder.Services.AddSingleton<IHostCapacity, DryRunHostCapacity>();
        }
        else
        {
            builder.Services.AddSingleton<IShell, ProcessShell>();
            builder.Services.AddSingleton<IDatabaseAdmin, NpgsqlDatabaseAdmin>();
            builder.Services.AddSingleton<IBrokerAdmin, RabbitCtlBrokerAdmin>();
            builder.Services.AddSingleton<IKeycloakAdmin, KeycloakRestAdmin>();
            builder.Services.AddSingleton<IStackTokenProvider, KeycloakStackTokenProvider>();
            builder.Services.AddSingleton<IStackProxy, HttpStackProxy>();
            builder.Services.AddSingleton<ITenantStack, HttpTenantStack>();
            builder.Services.AddSingleton<IHostCapacity, ProcHostCapacity>();
        }

        // The people who run the platform hold PlatformAdmin in the ninja realm
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("Platform", policy => policy.RequireRole("PlatformAdmin"));
    }
}

/// <summary>Dry run: the vhost exists as soon as it is asked for.</summary>
public sealed class DryRunBrokerAdmin(ILogger<DryRunBrokerAdmin> logger) : IBrokerAdmin
{
    public Task EnsureVHostAsync(string vhost, string user, CancellationToken ct) { logger.LogInformation("(dry run) vhost {VHost} for {User}", vhost, user); return Task.CompletedTask; }
    public Task DeleteVHostAsync(string vhost, CancellationToken ct) { logger.LogInformation("(dry run) delete vhost {VHost}", vhost); return Task.CompletedTask; }
}
