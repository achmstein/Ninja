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
    IAuditWriter audit,
    BackupService backups,
    MailQueue mail,
    ILogger<Provisioner> logger)
{
    private const string Source = "provisioner";

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
            await CredentialsStepAsync(tenant, runId, ct);
            await DatabasesStepAsync(tenant, runId, ct);

            // A restore loads the dumps into the empty databases now, before any
            // service boots: the dumps carry the migration history, so newer
            // images apply only what came after the backup
            var restore = BackupService.ParseRestoreFrom(tenant.RestoreFrom);
            if (restore is { } source)
            {
                await Step(tenant, runId, "restore-databases", async () =>
                {
                    await backups.RestoreDatabasesAsync(source.Slug, source.Id, tenant, ct);
                    return $"{TenantNaming.Databases.Length} databases from {tenant.RestoreFrom}";
                }, ct);
            }

            await BrokerStepAsync(tenant, runId, ct);

            await Step(tenant, runId, "realm", async () =>
            {
                var realm = TenantNaming.Realm(tenant.Slug);
                if (await keycloak.RealmExistsAsync(realm, ct)) return $"realm {realm} already there";
                await keycloak.CreateRealmAsync(Templates.TenantRealm(tenant, hosts, Platform), ct);
                return $"realm {realm}";
            }, ct);

            await StackStepAsync(tenant, runId, "stack", ct);

            await Step(tenant, runId, "edge", () => WriteEdgeAsync(ct), ct);

            await HealthStepAsync(tenant, runId, ct);

            if (restore is { } uploads)
            {
                await Step(tenant, runId, "restore-uploads", async () =>
                    await backups.RestoreUploadsAsync(uploads.Slug, uploads.Id, tenant, ct) ? $"uploads from {tenant.RestoreFrom}" : "the backup had no uploads", ct);
            }

            await Step(tenant, runId, "brand", async () =>
            {
                // A restored stack keeps the theme, switches and locale its dump brought; a fresh one starts with what the plan allows
                var kept = restore is null ? null : await stack.ReadBrandAsync(tenant, ct);
                var brand = new JsonObject
                {
                    ["name"] = new JsonObject { ["en"] = tenant.NameEn, ["ar"] = tenant.NameAr },
                    ["primaryColor"] = tenant.PrimaryColor,
                    ["customerUrl"] = hosts.CustomerUrl,
                    ["features"] = kept?["features"]?.DeepClone() ?? PlanCatalog.ToFeatures(PlanCatalog.Entitlements(tenant)),
                    ["theme"] = kept?["theme"]?.DeepClone() ?? new JsonObject(),
                    ["locale"] = new JsonObject
                    {
                        ["country"] = tenant.Country, ["currency"] = tenant.Currency, ["timeZone"] = tenant.TimeZone, ["language"] = tenant.DefaultLanguage,
                    },
                };
                var images = SeedImages(tenant);
                await stack.SeedBrandAsync(tenant, brand, images, ct);
                return images.Count == 0 ? "name and color" : $"name, color and {string.Join(", ", images.Keys)}";
            }, ct);

            await EntitlementsStepAsync(tenant, runId, ct);

            await Step(tenant, runId, "owner", async () =>
            {
                tenant.OwnerInitialPassword ??= TenantNaming.NewPassword();
                await keycloak.EnsureUserAsync(TenantNaming.Realm(tenant.Slug), tenant.OwnerEmail, tenant.NameEn, tenant.OwnerInitialPassword, ["Owner", "Admin", "Customer"], ct);
                return tenant.OwnerEmail;
            }, ct);

            await BrokerLockdownStepAsync(tenant, runId, ct);

            tenant.Status = TenantStatus.Running;
            tenant.ProvisionedAt ??= DateTimeOffset.UtcNow;
            tenant.RestoreFrom = null;
            // The owner hears once, with the temporary password; a retry of a failed stamp is the first time it can
            if (tenant.WelcomeSentAt is null)
            {
                mail.Enqueue(MailTemplates.Welcome(tenant, hosts, Platform.Mail));
                tenant.WelcomeSentAt = DateTimeOffset.UtcNow;
            }
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.provision.done", tenant.Slug, new { runId, imageTag = tenant.ImageTag, restoredFrom = restore?.Slug }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Provisioning {Slug} failed", tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.provision.failed", tenant.Slug, new { runId, error = ex.Message }, ct, Source);
            if (!string.IsNullOrWhiteSpace(Platform.Mail.OpsTo)) mail.Enqueue(MailTemplates.OpsProvisionFailed(tenant, runId, ex.Message, Platform));
        }
    }

    /// <summary>
    /// A stack stamped before tenants had credentials of their own moves onto
    /// its own database role and broker user; with <paramref name="rotate"/>,
    /// a stack that has them gets new passwords. Either way the stack is
    /// re-stamped and restarted, so the services come back on the new ones,
    /// and only then does the shared broker user lose the vhost.
    /// </summary>
    public async Task SecureAsync(Guid tenantId, bool rotate, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        tenant.Status = TenantStatus.Upgrading;
        tenant.LastError = null;
        if (rotate)
        {
            tenant.DbPassword = null;
            tenant.BrokerPassword = null;
        }
        await context.SaveChangesAsync(ct);

        try
        {
            await CredentialsStepAsync(tenant, runId, ct);
            await DatabasesStepAsync(tenant, runId, ct);
            await BrokerStepAsync(tenant, runId, ct);
            await StackStepAsync(tenant, runId, "stack", ct);
            await HealthStepAsync(tenant, runId, ct);
            await BrokerLockdownStepAsync(tenant, runId, ct);

            tenant.Status = TenantStatus.Running;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.secure.done", tenant.Slug, new { runId, rotated = rotate }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Securing {Slug} failed", tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.secure.failed", tenant.Slug, new { runId, rotated = rotate, error = ex.Message }, ct, Source);
        }
    }

    // ---------- the steps a stamp is made of, each idempotent, shared by provision, secure and upgrade ----------

    /// <summary>The tenant's own role and broker user. The passwords are saved before the box is touched: a crash after `create role` must not lose what the role was given.</summary>
    private Task<string> CredentialsStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "credentials", async () =>
        {
            var fresh = !tenant.HasOwnCredentials;
            tenant.DbPassword ??= TenantNaming.NewSecret();
            tenant.BrokerPassword ??= TenantNaming.NewSecret();
            await context.SaveChangesAsync(ct);
            await databases.EnsureRoleAsync(TenantNaming.DbRole(tenant.Slug), tenant.DbPassword, ct);
            await broker.EnsureUserAsync(TenantNaming.BrokerUser(tenant.Slug), tenant.BrokerPassword, ct);
            return $"role {TenantNaming.DbRole(tenant.Slug)}, user {TenantNaming.BrokerUser(tenant.Slug)}{(fresh ? "" : " (kept)")}";
        }, ct);

    /// <summary>The eleven databases, owned by the role (handed over when they predate it).</summary>
    private Task<string> DatabasesStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "databases", async () =>
        {
            foreach (var db in TenantNaming.Databases)
                await databases.EnsureDatabaseAsync(TenantNaming.Database(tenant.Slug, db), TenantNaming.DbRole(tenant.Slug), ct);
            return $"{TenantNaming.Databases.Length} databases owned by {TenantNaming.DbRole(tenant.Slug)}";
        }, ct);

    private Task<string> BrokerStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "broker", async () =>
        {
            await broker.EnsureVHostAsync(TenantNaming.VHost(tenant.Slug), TenantNaming.BrokerUser(tenant.Slug), ct);
            return $"vhost {TenantNaming.VHost(tenant.Slug)} for {TenantNaming.BrokerUser(tenant.Slug)}";
        }, ct);

    /// <summary>The compose file and .env rewritten from the record, then up (pulling when the platform pulls).</summary>
    private Task<string> StackStepAsync(Tenant tenant, Guid runId, string name, CancellationToken ct)
        => Step(tenant, runId, name, async () =>
        {
            var dir = Dir(tenant);
            await WriteStackFilesAsync(tenant, ct);
            var result = await shell.RunAsync("docker", UpArgs(tenant), dir, ct);
            if (!result.Ok) throw new InvalidOperationException(result.Output);
            return result.Output;
        }, ct);

    private Task<string> HealthStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "health", async () =>
        {
            await stack.WaitHealthyAsync(tenant, TimeSpan.FromMinutes(5), ct);
            return "every service answers";
        }, ct);

    /// <summary>What the plan allows, into Branch.API, which clamps the switches to it; a restore keeps its saved switches within that.</summary>
    private Task<string> EntitlementsStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "entitlements", async () =>
        {
            var entitled = PlanCatalog.Entitlements(tenant);
            await stack.PushEntitlementsAsync(tenant, PlanCatalog.ToFeatures(entitled), ct);
            return entitled.Count == PlanCatalog.All.Count ? "everything" : string.Join(", ", entitled.OrderBy(m => m).Select(PlanCatalog.Key));
        }, ct);

    /// <summary>
    /// The plan changed: the gateway is re-stamped (only it recreates, its env
    /// is all that differs; no pull) and Branch.API is told. A stack that is
    /// not running gets both when it next starts.
    /// </summary>
    public async Task EntitlementsAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        try
        {
            await Step(tenant, runId, "stack", async () =>
            {
                var dir = Dir(tenant);
                if (!Directory.Exists(dir)) return "nothing stamped";
                await WriteStackFilesAsync(tenant, ct);
                if (tenant.Status != TenantStatus.Running) return "files rewritten; applied on start";
                var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(tenant.Slug), "up", "-d", "--remove-orphans"], dir, ct);
                if (!result.Ok) throw new InvalidOperationException(result.Output);
                return result.Output;
            }, ct);
            if (tenant.Status == TenantStatus.Running) await EntitlementsStepAsync(tenant, runId, ct);
            await audit.WriteAsync("tenant.entitlements.done", tenant.Slug, new { runId, entitled = PlanCatalog.Entitlements(tenant).Select(PlanCatalog.Key) }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Entitlements for {Slug} failed", tenant.Slug);
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.entitlements.failed", tenant.Slug, new { runId, error = ex.Message }, ct, Source);
        }
    }

    private async Task WriteStackFilesAsync(Tenant tenant, CancellationToken ct)
    {
        var dir = Dir(tenant);
        Directory.CreateDirectory(dir);
        await File.WriteAllTextAsync(Path.Combine(dir, "docker-compose.yaml"), Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform), ct);
        await File.WriteAllTextAsync(Path.Combine(dir, ".env"), Templates.Env(tenant, Platform), ct);
    }

    /// <summary>The shared broker user off the vhost: what a stack stamped before it had a user of its own still connected as. Nothing to do for a fresh one.</summary>
    private Task<string> BrokerLockdownStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "broker-lockdown", async () =>
        {
            await broker.ClearPermissionsAsync(TenantNaming.VHost(tenant.Slug), Platform.RabbitUser, ct);
            return $"{Platform.RabbitUser} off vhost {TenantNaming.VHost(tenant.Slug)}";
        }, ct);

    public async Task DestroyAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        var was = tenant.Status;
        tenant.Status = TenantStatus.Destroying;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);

        try
        {
            // The folder goes with the stack, so its newest backup moves out first: a fresh one
            // for a stack that was up (its databases are still there to dump), whatever exists otherwise
            await Step(tenant, runId, "last-backup", async () =>
            {
                if (!Directory.Exists(Dir(tenant))) return "nothing stamped";
                var dumped = "";
                if (was is TenantStatus.Running or TenantStatus.Stopped && !backups.IsFresh(tenant.Slug, Platform.BackupFreshMinutes, out _))
                {
                    var created = await backups.CreateAsync(tenant, ct);
                    if (backups.OffsiteEnabled)
                    {
                        try { await backups.OffsiteAsync(tenant.Slug, created.Id, ct); }
                        catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogWarning(ex, "{Slug}: last backup stays on the box only", tenant.Slug); }
                    }
                    dumped = $"{created.Id} taken; ";
                }
                var kept = backups.ArchiveLatest(tenant.Slug);
                return kept is null ? $"{dumped}no backup to keep" : $"{dumped}{kept} kept under {BackupService.ArchiveSlug}";
            }, ct);

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
                await broker.DeleteUserAsync(TenantNaming.BrokerUser(tenant.Slug), ct);
                return "vhost and user gone";
            }, ct);

            await Step(tenant, runId, "databases-drop", async () =>
            {
                foreach (var db in TenantNaming.Databases)
                    await databases.DropDatabaseAsync(TenantNaming.Database(tenant.Slug, db), ct);
                return $"{TenantNaming.Databases.Length} databases";
            }, ct);

            // Owns nothing once its databases are gone; the passwords stay on the record for a re-provision
            await Step(tenant, runId, "role-drop", async () =>
            {
                await databases.DropRoleAsync(TenantNaming.DbRole(tenant.Slug), ct);
                return "gone";
            }, ct);

            tenant.Status = TenantStatus.Destroyed;
            tenant.OwnerInitialPassword = null;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.destroy.done", tenant.Slug, new { runId }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Destroying {Slug} failed", tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.destroy.failed", tenant.Slug, new { runId, error = ex.Message }, ct, Source);
        }
    }

    /// <summary>
    /// A new image tag: a backup first (one fresher than the window is reused),
    /// then the stack re-stamped and pulled, then health. When the new version
    /// is not healthy in time and there is a tag to go back to, the stack is
    /// rolled back to it and the tenant ends up Running with the reason on
    /// its record. A re-stamp is also where a stack from before tenants had
    /// credentials of their own gets them.
    /// </summary>
    public async Task UpgradeAsync(Guid tenantId, string? imageTag, Guid? canaryId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var target = string.IsNullOrWhiteSpace(imageTag) ? tenant.ImageTag : imageTag.Trim();

        // A fleet upgrade goes ahead only while its canary stands on the new tag
        if (canaryId is { } canary && tenant.Id != canary)
        {
            var ok = await context.Tenants.AsNoTracking().AnyAsync(t => t.Id == canary && t.Status == TenantStatus.Running && t.ImageTag == target, ct);
            if (!ok)
            {
                await audit.WriteAsync("tenant.upgrade.skipped", tenant.Slug, new { imageTag = target, reason = "the canary did not stay running on it" }, ct, Source);
                return;
            }
        }

        var runId = Guid.NewGuid();
        var from = tenant.ImageTag;
        tenant.Status = TenantStatus.Upgrading;
        tenant.LastError = null;
        if (target != tenant.ImageTag)
        {
            tenant.PreviousImageTag = tenant.ImageTag;
            tenant.ImageTag = target;
        }
        await context.SaveChangesAsync(ct);

        try
        {
            await CredentialsStepAsync(tenant, runId, ct);
            await DatabasesStepAsync(tenant, runId, ct);
            await BrokerStepAsync(tenant, runId, ct);
            await BackupStepAsync(tenant, runId, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Nothing has changed on the box yet: the record goes back to what it was
            logger.LogError(ex, "Upgrade of {Slug} failed before the stack was touched", tenant.Slug);
            tenant.ImageTag = from;
            if (tenant.PreviousImageTag == from) tenant.PreviousImageTag = null;
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.upgrade.failed", tenant.Slug, new { runId, from, to = target, error = ex.Message }, ct, Source);
            return;
        }

        try
        {
            await StackStepAsync(tenant, runId, "stack", ct);
            await HealthStepAsync(tenant, runId, ct);
            await BrokerLockdownStepAsync(tenant, runId, ct);

            tenant.Status = TenantStatus.Running;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.upgrade.done", tenant.Slug, new { runId, from, to = target, backupId = tenant.UpgradeBackupId }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Upgrade of {Slug} to {Tag} failed", tenant.Slug, target);
            if (tenant.PreviousImageTag is { } previous && previous != tenant.ImageTag)
            {
                await RollBackAsync(tenant, runId, previous, $"upgrade to {target} rolled back: {ex.Message}", ct);
                return;
            }
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.upgrade.failed", tenant.Slug, new { runId, from, to = target, error = ex.Message }, ct, Source);
        }
    }

    /// <summary>By hand: back to the previous tag. Migrations are forward-only, so going back past one means restoring the pre-upgrade backup into a new slug instead.</summary>
    public async Task RollbackAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        if (tenant.PreviousImageTag is not { } previous)
        {
            await audit.WriteAsync("tenant.rollback.failed", tenant.Slug, new { error = "no previous tag" }, ct, Source);
            return;
        }
        var runId = Guid.NewGuid();
        tenant.Status = TenantStatus.Upgrading;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);
        await RollBackAsync(tenant, runId, previous, null, ct);
    }

    /// <summary>The stack re-stamped on <paramref name="previous"/> and waited on. By hand, the tags swap so the rollback can itself be undone; after a failed upgrade the failed tag is nothing to go back to and stays in the audit only.</summary>
    private async Task RollBackAsync(Tenant tenant, Guid runId, string previous, string? reason, CancellationToken ct)
    {
        var failed = tenant.ImageTag;
        tenant.ImageTag = previous;
        tenant.PreviousImageTag = reason is null ? failed : null;
        await context.SaveChangesAsync(ct);
        try
        {
            await StackStepAsync(tenant, runId, "rollback", ct);
            await Step(tenant, runId, "rollback-health", async () =>
            {
                await stack.WaitHealthyAsync(tenant, TimeSpan.FromMinutes(5), ct);
                return "every service answers";
            }, ct);
            tenant.Status = TenantStatus.Running;
            tenant.LastError = reason;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync(reason is null ? "tenant.rollback.done" : "tenant.upgrade.rolledback", tenant.Slug, new { runId, from = failed, to = previous, backupId = tenant.UpgradeBackupId, reason }, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Rollback of {Slug} to {Tag} failed", tenant.Slug, previous);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = reason is null ? ex.Message : $"{reason}; the rollback failed too: {ex.Message}";
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.rollback.failed", tenant.Slug, new { runId, from = failed, to = previous, error = ex.Message }, ct, Source);
        }
    }

    /// <summary>A backup before anything changes; one younger than the window is reused. Its id stays on the record.</summary>
    private Task<string> BackupStepAsync(Tenant tenant, Guid runId, CancellationToken ct)
        => Step(tenant, runId, "backup", async () =>
        {
            if (backups.IsFresh(tenant.Slug, Platform.BackupFreshMinutes, out var newest))
            {
                tenant.UpgradeBackupId = newest!.Id;
                await context.SaveChangesAsync(ct);
                return $"reusing {newest.Id} from {(int)(DateTimeOffset.UtcNow - newest.At).TotalMinutes} min ago";
            }
            var created = await backups.CreateAsync(tenant, ct);
            backups.Prune(tenant.Slug, Platform.BackupsKeep);
            tenant.UpgradeBackupId = created.Id;
            await context.SaveChangesAsync(ct);
            if (backups.OffsiteEnabled)
            {
                try { await backups.OffsiteAsync(tenant.Slug, created.Id, ct); }
                catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogWarning(ex, "{Slug}: the pre-upgrade backup stays on the box only", tenant.Slug); }
            }
            return $"{created.Id}: {created.SizeBytes / (1024 * 1024)} MB";
        }, ct);

    /// <summary>stop or suspend, start or resume.</summary>
    public async Task ComposeAsync(Guid tenantId, string action, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        var dir = Dir(tenant);
        try
        {
            switch (action)
            {
                case "stop" or "suspend":
                    await Step(tenant, runId, action, async () =>
                    {
                        var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(tenant.Slug), "stop"], Directory.Exists(dir) ? dir : null, ct);
                        if (!result.Ok) throw new InvalidOperationException(result.Output);
                        return result.Output;
                    }, ct);
                    break;
                case "start" or "resume":
                    // up rather than start: a compose rewritten while the stack was down (a plan change) is applied; the images are already here
                    await Step(tenant, runId, action, async () =>
                    {
                        if (Directory.Exists(dir)) await WriteStackFilesAsync(tenant, ct);
                        var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(tenant.Slug), "up", "-d", "--remove-orphans"], Directory.Exists(dir) ? dir : null, ct);
                        if (!result.Ok) throw new InvalidOperationException(result.Output);
                        return result.Output;
                    }, ct);
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(action));
            }

            tenant.Status = action switch { "stop" => TenantStatus.Stopped, "suspend" => TenantStatus.Suspended, _ => TenantStatus.Running };
            if (action == "suspend") tenant.SuspendedAt ??= DateTimeOffset.UtcNow;
            if (action == "resume") tenant.SuspendedAt = null;
            tenant.LastError = null;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync($"tenant.{action}.done", tenant.Slug, null, ct, Source);

            // Back up, the stack hears what the plan allows now (its compose already does)
            if (action is "start" or "resume")
            {
                try { await EntitlementsStepAsync(tenant, runId, ct); }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "{Slug}: entitlements not pushed after {Action}", tenant.Slug, action);
                    tenant.LastError = ex.Message;
                    await context.SaveChangesAsync(ct);
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "{Action} on {Slug} failed", action, tenant.Slug);
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync($"tenant.{action}.failed", tenant.Slug, new { error = ex.Message }, ct, Source);
        }
    }

    /// <summary>A backup of the databases and the uploads, then the oldest go once there are more than kept; a copy off the box when there is somewhere to send it.</summary>
    public async Task BackupAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        var runId = Guid.NewGuid();
        BackupInfo? created = null;
        try
        {
            var info = await Step(tenant, runId, "backup", async () =>
            {
                created = await backups.CreateAsync(tenant, ct);
                var pruned = backups.Prune(tenant.Slug, Platform.BackupsKeep);
                return $"{created.Id}: {created.SizeBytes / (1024 * 1024)} MB{(pruned > 0 ? $", {pruned} older removed" : "")}";
            }, ct);
            await audit.WriteAsync("backup.done", tenant.Slug, new { output = info }, ct, "backup");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Backup of {Slug} failed", tenant.Slug);
            await audit.WriteAsync("backup.failed", tenant.Slug, new { error = ex.Message }, ct, "backup");
            if (!string.IsNullOrWhiteSpace(Platform.Mail.OpsTo)) mail.Enqueue(MailTemplates.OpsBackupFailed(tenant, ex.Message, Platform));
            return;
        }
        if (created is not null) await OffsiteStepAsync(tenant, runId, created.Id, ct);
    }

    /// <summary>The copy off the box, in its own step: a bucket that is down does not undo a backup that is on disk.</summary>
    private async Task OffsiteStepAsync(Tenant tenant, Guid runId, string id, CancellationToken ct)
    {
        if (!backups.OffsiteEnabled) return;
        try
        {
            await Step(tenant, runId, "offsite", async () =>
            {
                await backups.OffsiteAsync(tenant.Slug, id, ct);
                return backups.OffsiteKey(tenant.Slug, id);
            }, ct);
            await audit.WriteAsync("backup.offsite.done", tenant.Slug, new { id }, ct, "backup");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Offsite copy of {Slug}/{Id} failed", tenant.Slug, id);
            await audit.WriteAsync("backup.offsite.failed", tenant.Slug, new { id, error = ex.Message }, ct, "backup");
        }
    }

    /// <summary>Rewrite the edge's custom-domain sites after a domain changed on the record.</summary>
    public async Task EdgeAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        try
        {
            await Step(tenant, Guid.NewGuid(), "edge", () => WriteEdgeAsync(ct), ct);
            await audit.WriteAsync("tenant.edge.done", tenant.Slug, null, ct, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Edge rewrite for {Slug} failed", tenant.Slug);
            tenant.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.edge.failed", tenant.Slug, new { error = ex.Message }, ct, Source);
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

    /// <summary>Runs one step and records it; returns what the step said.</summary>
    private async Task<string> Step(Tenant tenant, Guid runId, string name, Func<Task<string>> work, CancellationToken ct)
    {
        var step = new ProvisioningStep { TenantId = tenant.Id, RunId = runId, Name = name, Status = StepStatus.Running };
        context.Steps.Add(step);
        await context.SaveChangesAsync(ct);
        try
        {
            var output = await work();
            step.Status = StepStatus.Done;
            step.Output = Truncate(output);
            return output;
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
/// <param name="ImageTag">For an upgrade: the tag to move to (null keeps the record's). On the job, not the record, so a queued fleet upgrade that never runs changes nothing.</param>
/// <param name="CanaryId">For a fleet upgrade: the tenant that went first; the rest run only while it stands Running on the tag.</param>
public sealed record ProvisioningJob(Guid TenantId, string Action, string? ImageTag = null, Guid? CanaryId = null);

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
                case "edge": await provisioner.EdgeAsync(job.TenantId, stoppingToken); break;
                case "backup": await provisioner.BackupAsync(job.TenantId, stoppingToken); break;
                case "secure": await provisioner.SecureAsync(job.TenantId, rotate: false, stoppingToken); break;
                case "rotate": await provisioner.SecureAsync(job.TenantId, rotate: true, stoppingToken); break;
                case "entitlements": await provisioner.EntitlementsAsync(job.TenantId, stoppingToken); break;
                case "upgrade": await provisioner.UpgradeAsync(job.TenantId, job.ImageTag, job.CanaryId, stoppingToken); break;
                case "rollback": await provisioner.RollbackAsync(job.TenantId, stoppingToken); break;
                default: await provisioner.ComposeAsync(job.TenantId, job.Action, stoppingToken); break;
            }
        }
    }
}

/// <summary>What the expiry sweep does with one demo.</summary>
public enum DemoAction
{
    None,
    /// <summary>Tell the owner it stops in a few days.</summary>
    Warn,
    Stop,
    /// <summary>Tell the owner the stopped demo is deleted in a few days.</summary>
    WarnDestroy,
    Destroy,
}

/// <summary>Demos expire: the owner is warned, the stack is stopped when its time is up, warned again, and destroyed after the grace days. Once an hour.</summary>
public sealed class DemoExpiryService(IServiceScopeFactory scopes, ProvisioningQueue queue, MailQueue mail, IOptions<PlatformOptions> options, ILogger<DemoExpiryService> logger) : BackgroundService
{
    /// <summary>Pure, for the test: what one demo needs now. A warning goes once (the record remembers) and an extension clears it.</summary>
    public static DemoAction Decide(Tenant t, DateTimeOffset now, int graceDays, int warnDays, int destroyWarnDays)
    {
        if (t.Kind != TenantKind.Demo || t.ExpiresAt is not { } expires) return DemoAction.None;
        switch (t.Status)
        {
            case TenantStatus.Running:
                if (now >= expires) return DemoAction.Stop;
                if (expires - now <= TimeSpan.FromDays(warnDays) && t.ExpiryWarnedAt is null) return DemoAction.Warn;
                return DemoAction.None;
            case TenantStatus.Stopped:
                var destroyAt = expires.AddDays(graceDays);
                if (now >= destroyAt) return DemoAction.Destroy;
                if (destroyAt - now <= TimeSpan.FromDays(destroyWarnDays) && t.DestroyWarnedAt is null) return DemoAction.WarnDestroy;
                return DemoAction.None;
            default:
                return DemoAction.None;
        }
    }

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
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var platform = options.Value;
        var now = DateTimeOffset.UtcNow;

        // Every live demo with an expiry: the ones about to expire get a warning, the rest is as before
        var demos = await context.Tenants
            .Where(t => t.Kind == TenantKind.Demo && t.ExpiresAt != null)
            .Where(t => t.Status == TenantStatus.Running || t.Status == TenantStatus.Stopped)
            .ToListAsync(ct);

        foreach (var tenant in demos)
        {
            var hosts = TenantHosts.For(tenant, platform);
            switch (Decide(tenant, now, platform.DemoGraceDays, platform.DemoWarnDays, platform.DemoDestroyWarnDays))
            {
                case DemoAction.Warn:
                    mail.Enqueue(MailTemplates.DemoExpiring(tenant, hosts, DaysLeft(tenant.ExpiresAt!.Value, now), platform.Mail));
                    tenant.ExpiryWarnedAt = now;
                    await audit.WriteAsync("demo.expiring", tenant.Slug, new { expiresAt = tenant.ExpiresAt }, ct, "expiry");
                    break;
                case DemoAction.Stop:
                    logger.LogInformation("Demo {Slug} expired; stopping", tenant.Slug);
                    mail.Enqueue(MailTemplates.DemoStopped(tenant, hosts, platform.DemoGraceDays, platform.Mail));
                    await audit.WriteAsync("demo.expired", tenant.Slug, new { expiresAt = tenant.ExpiresAt }, ct, "expiry");
                    await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "stop"), ct);
                    break;
                case DemoAction.WarnDestroy:
                    mail.Enqueue(MailTemplates.DemoDestroyedSoon(tenant, hosts, DaysLeft(tenant.ExpiresAt!.Value.AddDays(platform.DemoGraceDays), now), platform.Mail));
                    tenant.DestroyWarnedAt = now;
                    await audit.WriteAsync("demo.destroying-soon", tenant.Slug, new { expiresAt = tenant.ExpiresAt }, ct, "expiry");
                    break;
                case DemoAction.Destroy:
                    logger.LogInformation("Demo {Slug} past its grace; destroying", tenant.Slug);
                    await audit.WriteAsync("demo.grace-over", tenant.Slug, new { expiresAt = tenant.ExpiresAt, graceDays = platform.DemoGraceDays }, ct, "expiry");
                    await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "destroy"), ct);
                    break;
            }
        }
        await context.SaveChangesAsync(ct);
    }

    /// <summary>Whole days until <paramref name="at"/>, never less than one: "1 day left" on the last day, not "0 days".</summary>
    private static int DaysLeft(DateTimeOffset at, DateTimeOffset now) => Math.Max(1, (int)Math.Ceiling((at - now).TotalDays));
}
