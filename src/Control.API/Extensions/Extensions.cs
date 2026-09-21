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

        builder.Services.AddOptions<PlatformOptions>()
            .Bind(builder.Configuration.GetSection(PlatformOptions.Section))
            .Validate(o => o.ServiceMemoryMb >= 128 && o.GatewayMemoryMb >= 64, "A service needs at least 128 MB and the gateway 64 MB")
            .Validate(o => o.StackFootprintMb <= o.StackLimitMb, "StackFootprintMb is more than the per-container caps add up to")
            .ValidateOnStart();

        // Kinds and statuses travel as their names, not their numbers
        builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        // No cookie jar: the impersonation call's Set-Cookie headers are read off the response and handed to a browser.
        // No standard resilience on these two: it retries PUTs that are not idempotent (a realm, a brand image) and its
        // circuit breaker trips while a stack is still coming up; the provisioner does its own waiting.
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is marked experimental; the alternative is to hand-roll the pipeline
        builder.Services.AddHttpClient("keycloak").ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { UseCookies = false }).RemoveAllResilienceHandlers();
        builder.Services.AddSingleton<ImpersonationTickets>();
        builder.Services.AddHttpClient("stack", client => client.Timeout = TimeSpan.FromSeconds(30)).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<IAuditWriter, AuditWriter>();
        builder.Services.AddSingleton<ProvisioningQueue>();
        builder.Services.AddScoped<Provisioner>();
        builder.Services.AddScoped<SubscriptionService>();
        builder.Services.AddSingleton<CapacityCache>();
        builder.Services.AddSingleton<UpdateCache>();
        builder.Services.AddHttpClient("registry", client => client.Timeout = TimeSpan.FromSeconds(20));
        builder.Services.AddSingleton<TenantOps>();
        builder.Services.AddSingleton<TenantMetricsCollector>();
        builder.Services.AddSingleton<BackupService>();
        builder.Services.AddSingleton<PlatformBackupService>();

        // Mail goes out only once a host is set; until then every mail is audited as skipped
        builder.Services.AddSingleton<MailQueue>();
        builder.Services.AddSingleton<MailStatus>();
        var mail = builder.Configuration.GetSection($"{PlatformOptions.Section}:Mail").Get<MailOptions>() ?? new();
        if (mail.Configured) builder.Services.AddSingleton<IMailer, SmtpMailer>();
        else builder.Services.AddSingleton<IMailer, NullMailer>();

        var dryRun = builder.Configuration.GetValue<bool>($"{PlatformOptions.Section}:DryRun");

        // The build boots the app once to write its OpenAPI document; there is no box, no database and no queue to serve then
        if (!builder.Environment.IsBuild())
        {
            builder.Services.AddHostedService<ProvisioningWorker>();
            builder.Services.AddHostedService<MailSender>();
            builder.Services.AddHostedService<DemoExpiryService>();
            builder.Services.AddHostedService<SubscriptionSweepService>();
            builder.Services.AddHostedService<CapacityMonitor>();
            builder.Services.AddHostedService<UpdateMonitor>();
            builder.Services.AddHostedService<NightlyBackupService>();
            if (builder.Configuration.GetValue<bool>($"{PlatformOptions.Section}:RestoreDrill:Enabled"))
                builder.Services.AddHostedService<RestoreDrillService>();
            // The platform's own databases stop accepting PUBLIC; a dry run has none
            if (!dryRun) builder.Services.AddHostedService<PlatformLockdownService>();
        }

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
            builder.Services.AddSingleton<IOffsiteStore, RecordingOffsiteStore>();
            builder.Services.AddSingleton<DryRunImageRegistry>();
            builder.Services.AddSingleton<IImageRegistry>(sp => sp.GetRequiredService<DryRunImageRegistry>());
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
            builder.Services.AddSingleton<IImageRegistry, OciImageRegistry>();
            // Off the box only once a bucket and keys are set; until then the UI says the backups stay here
            var offsite = builder.Configuration.GetSection($"{PlatformOptions.Section}:Offsite").Get<OffsiteOptions>() ?? new();
            if (offsite.Enabled) builder.Services.AddSingleton<IOffsiteStore, S3OffsiteStore>();
            else builder.Services.AddSingleton<IOffsiteStore, NoOffsiteStore>();
        }

        // The people who run the platform hold PlatformAdmin in the ninja realm
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("Platform", policy => policy.RequireRole("PlatformAdmin"));
    }
}

/// <summary>Dry run: the user and the vhost exist as soon as they are asked for.</summary>
public sealed class DryRunBrokerAdmin(ILogger<DryRunBrokerAdmin> logger) : IBrokerAdmin
{
    public List<string> Users { get; } = [];
    public Task EnsureUserAsync(string user, string password, CancellationToken ct) { if (!Users.Contains(user)) Users.Add(user); logger.LogInformation("(dry run) broker user {User}", user); return Task.CompletedTask; }
    public Task EnsureVHostAsync(string vhost, string user, CancellationToken ct) { logger.LogInformation("(dry run) vhost {VHost} for {User}", vhost, user); return Task.CompletedTask; }
    public Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct) { logger.LogInformation("(dry run) {User} off vhost {VHost}", user, vhost); return Task.CompletedTask; }
    public Task DeleteVHostAsync(string vhost, CancellationToken ct) { logger.LogInformation("(dry run) delete vhost {VHost}", vhost); return Task.CompletedTask; }
    public Task DeleteUserAsync(string user, CancellationToken ct) { Users.Remove(user); logger.LogInformation("(dry run) delete broker user {User}", user); return Task.CompletedTask; }
}
