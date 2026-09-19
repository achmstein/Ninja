using System.Text.Json.Nodes;
using System.Threading.Channels;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// Brings a tenant up, takes it down, starts, stops and upgrades it: a list
/// of named steps, each idempotent, each recorded, so a failed run is
/// retried from the top and the control app can show where it stands.
/// </summary>
public sealed class Provisioner(
    ControlContext context,
    IOptions<PlatformOptions> options,
    IShell shell,
    IDatabaseAdmin databases,
    IBrokerAdmin broker,
    IKeycloakAdmin keycloak,
    ITenantStack stack,
    ILogger<Provisioner> logger)
{
    private PlatformOptions Platform => options.Value;

    private string Dir(Tenant tenant) => Path.Combine(Platform.TenantsRoot, tenant.Slug);

    /// <summary>Where an image uploaded before provisioning waits for the brand step: {tenants}/{slug}/seed/{slot}.png.</summary>
    public string SeedImagePath(Tenant tenant, string slot) => Path.Combine(Dir(tenant), "seed", $"{slot}.png");

    /// <summary>The seed images on disk, by slot.</summary>
    public IReadOnlyDictionary<string, string> SeedImages(Tenant tenant)
        => BrandImageSlots.All.Where(slot => File.Exists(SeedImagePath(tenant, slot))).ToDictionary(slot => slot, slot => SeedImagePath(tenant, slot));

    public async Task ProvisionAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var hosts = TenantHosts.For(tenant, Platform);
        var runId = Guid.NewGuid();
        tenant.Status = TenantStatus.Provisioning;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);

        try
        {
            await Step(tenant, runId, "databases", async () =>
            {
                foreach (var db in TenantNaming.Databases)
                    await databases.EnsureDatabaseAsync(TenantNaming.Database(tenant.Slug, db), ct);
                return $"{TenantNaming.Databases.Length} databases";
            }, ct);

            await Step(tenant, runId, "broker", async () =>
            {
                await broker.EnsureVHostAsync(TenantNaming.VHost(tenant.Slug), Platform.RabbitUser, ct);
                return $"vhost {TenantNaming.VHost(tenant.Slug)}";
            }, ct);

            await Step(tenant, runId, "realm", async () =>
            {
                var realm = TenantNaming.Realm(tenant.Slug);
                if (await keycloak.RealmExistsAsync(realm, ct)) return $"realm {realm} already there";
                await keycloak.CreateRealmAsync(Templates.TenantRealm(tenant, hosts, Platform), ct);
                return $"realm {realm}";
            }, ct);

            await Step(tenant, runId, "stack", async () =>
            {
                var dir = Dir(tenant);
                Directory.CreateDirectory(dir);
                await File.WriteAllTextAsync(Path.Combine(dir, "docker-compose.yaml"), Templates.Compose(tenant, hosts, Platform), ct);
                await File.WriteAllTextAsync(Path.Combine(dir, ".env"), Templates.Env(tenant, Platform), ct);
                var result = await shell.RunAsync("docker", UpArgs(tenant), dir, ct);
                if (!result.Ok) throw new InvalidOperationException(result.Output);
                return result.Output;
            }, ct);

            await Step(tenant, runId, "edge", () => WriteEdgeAsync(ct), ct);

            await Step(tenant, runId, "health", async () =>
            {
                await stack.WaitHealthyAsync(tenant, TimeSpan.FromMinutes(5), ct);
                return "every service answers";
            }, ct);

            await Step(tenant, runId, "brand", async () =>
            {
                var brand = new JsonObject
                {
                    ["name"] = new JsonObject { ["en"] = tenant.NameEn, ["ar"] = tenant.NameAr },
                    ["primaryColor"] = tenant.PrimaryColor,
                    ["customerUrl"] = hosts.CustomerUrl,
                    ["features"] = new JsonObject
                    {
                        ["rooms"] = true, ["loyalty"] = true, ["tabs"] = true, ["inventory"] = true,
                        ["finance"] = true, ["payroll"] = true, ["kds"] = true,
                    },
                    ["theme"] = new JsonObject(),
                };
                var images = SeedImages(tenant);
                await stack.SeedBrandAsync(tenant, brand, images, ct);
                return images.Count == 0 ? "name and color" : $"name, color and {string.Join(", ", images.Keys)}";
            }, ct);

            await Step(tenant, runId, "owner", async () =>
            {
                tenant.OwnerInitialPassword ??= TenantNaming.NewPassword();
                await keycloak.EnsureUserAsync(TenantNaming.Realm(tenant.Slug), tenant.OwnerEmail, tenant.NameEn, tenant.OwnerInitialPassword, ["Owner", "Admin", "Customer"], ct);
                return tenant.OwnerEmail;
            }, ct);

            tenant.Status = TenantStatus.Running;
            tenant.ProvisionedAt ??= DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Provisioning {Slug} failed", tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
        }
    }

    public async Task DestroyAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        tenant.Status = TenantStatus.Destroying;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);

        try
        {
            await Step(tenant, runId, "stack-down", async () =>
            {
                var dir = Dir(tenant);
                if (!Directory.Exists(dir)) return "nothing stamped";
                var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(tenant.Slug), "down", "-v", "--remove-orphans"], dir, ct);
                if (!result.Ok) throw new InvalidOperationException(result.Output);
                Directory.Delete(dir, recursive: true);
                return result.Output;
            }, ct);

            await Step(tenant, runId, "edge", async () =>
            {
                tenant.CustomerDomain = null;
                return await WriteEdgeAsync(ct);
            }, ct);

            await Step(tenant, runId, "realm-delete", async () =>
            {
                await keycloak.DeleteRealmAsync(TenantNaming.Realm(tenant.Slug), ct);
                return "gone";
            }, ct);

            await Step(tenant, runId, "broker-delete", async () =>
            {
                await broker.DeleteVHostAsync(TenantNaming.VHost(tenant.Slug), ct);
                return "gone";
            }, ct);

            await Step(tenant, runId, "databases-drop", async () =>
            {
                foreach (var db in TenantNaming.Databases)
                    await databases.DropDatabaseAsync(TenantNaming.Database(tenant.Slug, db), ct);
                return $"{TenantNaming.Databases.Length} databases";
            }, ct);

            tenant.Status = TenantStatus.Destroyed;
            tenant.OwnerInitialPassword = null;
            await context.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Destroying {Slug} failed", tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
        }
    }

    /// <summary>stop, start, or upgrade (rewrite the stack on the tenant's tag, pull, up).</summary>
    public async Task ComposeAsync(Guid tenantId, string action, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        var dir = Dir(tenant);
        try
        {
            await Step(tenant, runId, action, async () =>
            {
                string[] args = action switch
                {
                    "stop" => ["compose", "-p", TenantNaming.Project(tenant.Slug), "stop"],
                    "start" => ["compose", "-p", TenantNaming.Project(tenant.Slug), "start"],
                    "upgrade" => UpArgs(tenant),
                    _ => throw new ArgumentOutOfRangeException(nameof(action)),
                };
                if (action == "upgrade")
                {
                    Directory.CreateDirectory(dir);
                    await File.WriteAllTextAsync(Path.Combine(dir, "docker-compose.yaml"), Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform), ct);
                    await File.WriteAllTextAsync(Path.Combine(dir, ".env"), Templates.Env(tenant, Platform), ct);
                }
                var result = await shell.RunAsync("docker", args, Directory.Exists(dir) ? dir : null, ct);
                if (!result.Ok) throw new InvalidOperationException(result.Output);
                return result.Output;
            }, ct);

            tenant.Status = action == "stop" ? TenantStatus.Stopped : TenantStatus.Running;
            tenant.LastError = null;
            await context.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "{Action} on {Slug} failed", action, tenant.Slug);
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
        }
    }

    private string[] UpArgs(Tenant tenant)
        => Platform.PullImages
            ? ["compose", "-p", TenantNaming.Project(tenant.Slug), "up", "-d", "--pull", "always", "--remove-orphans"]
            : ["compose", "-p", TenantNaming.Project(tenant.Slug), "up", "-d", "--remove-orphans"];

    /// <summary>The custom-domain sites of every live tenant, then a Caddy reload; nothing when no café has its own domain yet.</summary>
    private async Task<string> WriteEdgeAsync(CancellationToken ct)
    {
        var live = await context.Tenants.AsNoTracking().Where(t => t.Status != TenantStatus.Destroyed && t.Status != TenantStatus.Destroying && t.CustomerDomain != null).ToListAsync(ct);
        var snippet = Templates.CustomDomains(live, Platform);
        var path = Platform.EdgeSnippetPath;
        if (File.Exists(path) && await File.ReadAllTextAsync(path, ct) == snippet)
            return "unchanged";
        if (Platform.DryRun && !Directory.Exists(Path.GetDirectoryName(path)!))
            return $"(dry run) {live.Count} custom domain(s)";
        await File.WriteAllTextAsync(path, snippet, ct);
        var reload = await shell.RunAsync("docker", ["exec", Platform.EdgeContainer, "caddy", "reload", "--config", "/etc/caddy/Caddyfile"], null, ct);
        if (!reload.Ok) throw new InvalidOperationException(reload.Output);
        return $"{live.Count} custom domain(s)";
    }

    private async Task Step(Tenant tenant, Guid runId, string name, Func<Task<string>> work, CancellationToken ct)
    {
        var step = new ProvisioningStep { TenantId = tenant.Id, RunId = runId, Name = name, Status = StepStatus.Running };
        context.Steps.Add(step);
        await context.SaveChangesAsync(ct);
        try
        {
            var output = await work();
            step.Status = StepStatus.Done;
            step.Output = Truncate(output);
        }
        catch (Exception ex)
        {
            step.Status = StepStatus.Failed;
            step.Output = Truncate(ex.Message);
            throw;
        }
        finally
        {
            step.FinishedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(CancellationToken.None);
        }
    }

    private static string Truncate(string s) => s.Length <= 4000 ? s : s[..4000];
}

/// <summary>One job at a time, in order: docker compose on one box does not like parallel stamps.</summary>
public sealed record ProvisioningJob(Guid TenantId, string Action);

public sealed class ProvisioningQueue
{
    private readonly Channel<ProvisioningJob> _channel = Channel.CreateUnbounded<ProvisioningJob>();

    public ValueTask EnqueueAsync(ProvisioningJob job, CancellationToken ct) => _channel.Writer.WriteAsync(job, ct);

    public IAsyncEnumerable<ProvisioningJob> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class ProvisioningWorker(ProvisioningQueue queue, IServiceScopeFactory scopes, ILogger<ProvisioningWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            using var scope = scopes.CreateScope();
            var provisioner = scope.ServiceProvider.GetRequiredService<Provisioner>();
            logger.LogInformation("{Action} {TenantId}", job.Action, job.TenantId);
            switch (job.Action)
            {
                case "provision": await provisioner.ProvisionAsync(job.TenantId, stoppingToken); break;
                case "destroy": await provisioner.DestroyAsync(job.TenantId, stoppingToken); break;
                default: await provisioner.ComposeAsync(job.TenantId, job.Action, stoppingToken); break;
            }
        }
    }
}

/// <summary>Demos expire: stopped when their time is up, destroyed after the grace days. Once an hour.</summary>
public sealed class DemoExpiryService(IServiceScopeFactory scopes, ProvisioningQueue queue, IOptions<PlatformOptions> options, ILogger<DemoExpiryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Demo sweep failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    internal async Task SweepAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var now = DateTimeOffset.UtcNow;
        var grace = TimeSpan.FromDays(options.Value.DemoGraceDays);

        var due = await context.Tenants
            .Where(t => t.Kind == TenantKind.Demo && t.ExpiresAt != null && t.ExpiresAt <= now)
            .Where(t => t.Status == TenantStatus.Running || t.Status == TenantStatus.Stopped)
            .ToListAsync(ct);

        foreach (var tenant in due)
        {
            if (tenant.Status == TenantStatus.Running)
            {
                logger.LogInformation("Demo {Slug} expired; stopping", tenant.Slug);
                await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "stop"), ct);
            }
            else if (tenant.ExpiresAt + grace <= now)
            {
                logger.LogInformation("Demo {Slug} past its grace; destroying", tenant.Slug);
                await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "destroy"), ct);
            }
        }
    }
}
