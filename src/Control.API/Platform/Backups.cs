using System.Formats.Tar;
using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// One backup of a tenant: its eleven databases and its uploads, under
/// {tenants}/{slug}/backups/{id}/. <paramref name="OffsiteAt"/> is when its
/// copy reached the bucket; <paramref name="VerifiedAt"/> when a drill
/// restored it into a scratch stack that came up healthy. Older manifests
/// carry neither.
/// </summary>
/// <param name="Sha256">Each file's checksum, hex, by file name; checked before a copy leaves the box and before a dump is restored. Older manifests carry none.</param>
public sealed record BackupInfo(string Id, DateTimeOffset At, long SizeBytes, IReadOnlyList<string> Databases, bool HasUploads, string ImageTag, DateTimeOffset? OffsiteAt = null, DateTimeOffset? VerifiedAt = null, IReadOnlyDictionary<string, string>? Sha256 = null);

/// <summary>
/// Dumps and restores through the shared Postgres container and a throwaway
/// alpine for the uploads volume, everything streamed: the tenants root may
/// be a named volume (it is on a laptop), so nothing is bind-mounted.
/// </summary>
public sealed class BackupService(IShell shell, IOffsiteStore store, IOptions<PlatformOptions> options, ILogger<BackupService> logger)
{
    private const string Manifest = "manifest.json";
    private const string Uploads = "uploads.tar.gz";

    /// <summary>The platform's own backups live beside the tenants' under a name no slug can take (_ is not a slug character).</summary>
    public const string PlatformSlug = "_platform";

    /// <summary>A destroyed tenant's last backup moves here rather than going with its folder.</summary>
    public const string ArchiveSlug = "_archive";

    /// <summary>Every tenant's secrets, realms and users: what a dead box must not take with it.</summary>
    public static readonly string[] PlatformDatabases = ["controldb", "keycloak"];

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private PlatformOptions Platform => options.Value;

    public bool OffsiteEnabled => store.Enabled;

    public string Root(string slug) => Path.Combine(Platform.TenantsRoot, slug, "backups");

    public string Dir(string slug, string id) => Path.Combine(Root(slug), id);

    public string OffsiteKey(string slug, string id) => $"{Platform.Offsite.Prefix}{slug}/{id}.tar.gz";

    public async Task<BackupInfo> CreateAsync(Tenant tenant, CancellationToken ct)
    {
        EnsureRoomOnDisk();
        var id = NewId();
        var dir = Dir(tenant.Slug, id);
        Directory.CreateDirectory(dir);
        try
        {
            foreach (var db in TenantNaming.Databases)
                await DumpAsync(TenantNaming.Database(tenant.Slug, db), Path.Combine(dir, $"{db}.dump"), ct);

            var hasUploads = true;
            await using (var archive = File.Create(Path.Combine(dir, Uploads)))
            {
                var result = await shell.RunAsync("docker",
                    ["run", "--rm", "-v", $"{TenantNaming.UploadsVolumeOnDocker(tenant.Slug)}:/from:ro", "alpine", "tar", "czf", "-", "-C", "/from", "."],
                    null, null, archive, ct);
                if (!result.Ok)
                {
                    // A stack that never uploaded anything may have no volume yet; the databases are the backup
                    logger.LogWarning("{Slug}: no uploads archived: {Output}", tenant.Slug, result.Output);
                    hasUploads = false;
                }
            }
            if (!hasUploads) File.Delete(Path.Combine(dir, Uploads));

            var info = new BackupInfo(id, DateTimeOffset.UtcNow, Size(dir), TenantNaming.Databases, hasUploads, tenant.ImageTag, Sha256: await ChecksumsAsync(dir, ct));
            await File.WriteAllTextAsync(Path.Combine(dir, Manifest), JsonSerializer.Serialize(info, Json), ct);
            return info;
        }
        catch
        {
            Directory.Delete(dir, recursive: true);
            throw;
        }
    }

    /// <summary>The platform's own databases, the same way, under _platform; nothing to archive besides.</summary>
    public async Task<BackupInfo> CreatePlatformAsync(CancellationToken ct)
    {
        EnsureRoomOnDisk();
        var id = NewId();
        var dir = Dir(PlatformSlug, id);
        Directory.CreateDirectory(dir);
        try
        {
            foreach (var db in PlatformDatabases)
                await DumpAsync(db, Path.Combine(dir, $"{db}.dump"), ct);
            var info = new BackupInfo(id, DateTimeOffset.UtcNow, Size(dir), PlatformDatabases, HasUploads: false, ImageTag: "", Sha256: await ChecksumsAsync(dir, ct));
            await File.WriteAllTextAsync(Path.Combine(dir, Manifest), JsonSerializer.Serialize(info, Json), ct);
            return info;
        }
        catch
        {
            Directory.Delete(dir, recursive: true);
            throw;
        }
    }

    /// <summary>
    /// The backup as one archive into the bucket, then its manifest says when.
    /// Through a file rather than a stream: the SDK's multipart upload retries
    /// a part only when it can seek back to it.
    /// </summary>
    public async Task<BackupInfo> OffsiteAsync(string slug, string id, CancellationToken ct)
    {
        var info = Find(slug, id) ?? throw new FileNotFoundException($"No backup {id} for {slug}");
        await VerifyAsync(slug, info, ct);
        var tmp = Path.Combine(Root(slug), $"{id}.tar.gz.tmp");
        try
        {
            await using (var file = File.Create(tmp))
                await WriteArchiveAsync(slug, id, file, ct);
            await store.UploadFileAsync(OffsiteKey(slug, id), tmp, ct);
        }
        finally
        {
            File.Delete(tmp);
        }
        return Update(slug, id, b => b with { OffsiteAt = DateTimeOffset.UtcNow }) ?? info;
    }

    /// <summary>Best effort: the bucket's copy of a backup that is being deleted here; a failure is logged, never surfaced.</summary>
    public async Task DeleteOffsiteAsync(string slug, string id, CancellationToken ct)
    {
        if (!store.Enabled) return;
        try
        {
            await store.DeleteAsync(OffsiteKey(slug, id), ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "{Slug}/{Id}: the offsite copy stays", slug, id);
        }
    }

    /// <summary>Rewrites one manifest; null when there is no such backup.</summary>
    public BackupInfo? Update(string slug, string id, Func<BackupInfo, BackupInfo> change)
    {
        var current = Find(slug, id);
        if (current is null) return null;
        var changed = change(current);
        File.WriteAllText(Path.Combine(Dir(slug, id), Manifest), JsonSerializer.Serialize(changed, Json));
        return changed;
    }

    /// <summary>Whether the newest backup is younger than <paramref name="minutes"/>; the newest either way.</summary>
    public bool IsFresh(string slug, int minutes, out BackupInfo? newest)
    {
        newest = List(slug).FirstOrDefault();
        return newest is not null && DateTimeOffset.UtcNow - newest.At < TimeSpan.FromMinutes(minutes);
    }

    /// <summary>The newest backup out of the tenant's folder (which a destroy deletes) into _archive/{slug}/{id}: a move on the same volume, instant. The id, or null when there was none.</summary>
    public string? ArchiveLatest(string slug)
    {
        var newest = List(slug).FirstOrDefault();
        if (newest is null) return null;
        var target = Path.Combine(Platform.TenantsRoot, ArchiveSlug, slug, newest.Id);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        if (Directory.Exists(target)) Directory.Delete(target, recursive: true);
        Directory.Move(Dir(slug, newest.Id), target);
        return newest.Id;
    }

    /// <summary>Archived backups older than <paramref name="keepDays"/> (by the id's own timestamp) go; returns how many.</summary>
    public int PruneArchive(int keepDays)
    {
        var root = Path.Combine(Platform.TenantsRoot, ArchiveSlug);
        if (!Directory.Exists(root)) return 0;
        var cutoff = DateTimeOffset.UtcNow.AddDays(-keepDays);
        var gone = 0;
        foreach (var tenantDir in Directory.EnumerateDirectories(root))
        {
            foreach (var backupDir in Directory.EnumerateDirectories(tenantDir))
            {
                var id = Path.GetFileName(backupDir);
                if (!IsValidId(id) || !DateTimeOffset.TryParseExact(id, "yyyyMMdd-HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) || at >= cutoff) continue;
                Directory.Delete(backupDir, recursive: true);
                gone++;
            }
            if (!Directory.EnumerateFileSystemEntries(tenantDir).Any()) Directory.Delete(tenantDir);
        }
        return gone;
    }

    public IReadOnlyList<BackupInfo> List(string slug)
    {
        var root = Root(slug);
        if (!Directory.Exists(root)) return [];
        var backups = new List<BackupInfo>();
        foreach (var dir in Directory.EnumerateDirectories(root))
        {
            var manifest = Path.Combine(dir, Manifest);
            if (!File.Exists(manifest)) continue;
            try
            {
                if (JsonSerializer.Deserialize<BackupInfo>(File.ReadAllText(manifest), Json) is { } info)
                    backups.Add(info);
            }
            catch (JsonException) { }
        }
        return backups.OrderByDescending(b => b.Id, StringComparer.Ordinal).ToList();
    }

    public BackupInfo? Find(string slug, string id)
        => IsValidId(id) ? List(slug).FirstOrDefault(b => b.Id == id) : null;

    public bool Delete(string slug, string id)
    {
        if (!IsValidId(id)) return false;
        var dir = Dir(slug, id);
        if (!Directory.Exists(dir)) return false;
        Directory.Delete(dir, recursive: true);
        return true;
    }

    /// <summary>Keeps the newest <paramref name="keep"/>; returns how many went.</summary>
    public int Prune(string slug, int keep)
    {
        var gone = 0;
        foreach (var old in List(slug).Skip(Math.Max(0, keep)))
        {
            if (Delete(slug, old.Id)) gone++;
        }
        return gone;
    }

    /// <summary>The backup's folder as one .tar.gz, written straight to <paramref name="output"/>.</summary>
    public async Task WriteArchiveAsync(string slug, string id, Stream output, CancellationToken ct)
    {
        await using var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true);
        await TarFile.CreateFromDirectoryAsync(Dir(slug, id), gzip, includeBaseDirectory: true, ct);
    }

    /// <summary>The dumps into <paramref name="into"/>'s empty databases, before its services boot and migrate.</summary>
    public async Task RestoreDatabasesAsync(string fromSlug, string id, Tenant into, CancellationToken ct)
    {
        var dir = Dir(fromSlug, id);
        if (Find(fromSlug, id) is { } info) await VerifyAsync(fromSlug, info, ct);
        foreach (var db in TenantNaming.Databases)
        {
            var dump = Path.Combine(dir, $"{db}.dump");
            if (!File.Exists(dump)) throw new FileNotFoundException($"{db}.dump is missing from backup {id}");
            await using var file = File.OpenRead(dump);
            var result = await shell.RunAsync("docker",
                // As the new tenant's role, or the superuser would own every restored table and the role could not migrate or write them
                ["exec", "-i", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_restore", "-U", Platform.PostgresUser, "--no-owner", "--role", TenantNaming.DbRole(into.Slug), "--clean", "--if-exists", "-d", TenantNaming.Database(into.Slug, db)],
                null, file, Stream.Null, ct);
            if (!result.Ok) throw new InvalidOperationException($"pg_restore {db}: {result.Output}");
        }
    }

    /// <summary>The uploads into <paramref name="into"/>'s volume, which exists once its stack is up.</summary>
    public async Task<bool> RestoreUploadsAsync(string fromSlug, string id, Tenant into, CancellationToken ct)
    {
        var archive = Path.Combine(Dir(fromSlug, id), Uploads);
        if (!File.Exists(archive)) return false;
        await using var file = File.OpenRead(archive);
        var result = await shell.RunAsync("docker",
            ["run", "-i", "--rm", "-v", $"{TenantNaming.UploadsVolumeOnDocker(into.Slug)}:/to", "alpine", "tar", "xzf", "-", "-C", "/to"],
            null, file, Stream.Null, ct);
        if (!result.Ok) throw new InvalidOperationException($"uploads: {result.Output}");
        return true;
    }

    /// <summary>Every file's SHA-256, hex, by name: what the manifest carries and what a copy or a restore is checked against.</summary>
    internal static async Task<IReadOnlyDictionary<string, string>> ChecksumsAsync(string dir, CancellationToken ct)
    {
        var sums = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var file in Directory.EnumerateFiles(dir).Where(f => Path.GetFileName(f) != Manifest).Order(StringComparer.Ordinal))
        {
            await using var stream = File.OpenRead(file);
            sums[Path.GetFileName(file)] = Convert.ToHexStringLower(await System.Security.Cryptography.SHA256.HashDataAsync(stream, ct));
        }
        return sums;
    }

    /// <summary>The files against the manifest's checksums; a backup without any (older than checksums) passes. A mismatch throws: a corrupt dump must not be copied as a good one or restored over an empty database.</summary>
    public async Task VerifyAsync(string slug, BackupInfo info, CancellationToken ct)
    {
        if (info.Sha256 is null) return;
        var actual = await ChecksumsAsync(Dir(slug, info.Id), ct);
        var bad = info.Sha256.Where(kv => !actual.TryGetValue(kv.Key, out var sum) || sum != kv.Value).Select(kv => kv.Key).ToList();
        if (bad.Count > 0) throw new InvalidOperationException($"Backup {slug}/{info.Id} is corrupt: {string.Join(", ", bad)} does not match the manifest");
    }

    /// <summary>The floor on the tenants drive: a dump that fills the disk takes the shared Postgres down for every café.</summary>
    private void EnsureRoomOnDisk()
    {
        try
        {
            if (!Directory.Exists(Platform.TenantsRoot)) return;
            var free = new DriveInfo(Platform.TenantsRoot).AvailableFreeSpace / (1024 * 1024);
            if (free < Platform.MinFreeDiskMb)
                throw new InvalidOperationException($"{free} MB free on the tenants drive, below the {Platform.MinFreeDiskMb} MB floor: no backup until space is freed");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            logger.LogWarning(ex, "Could not read the tenants drive; backing up anyway");
        }
    }

    /// <summary>"{slug}/{id}", as a tenant remembers what it is being restored from.</summary>
    public static (string Slug, string Id)? ParseRestoreFrom(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var parts = value.Split('/');
        return parts.Length == 2 && TenantNaming.IsValidSlug(parts[0]) && IsValidId(parts[1]) ? (parts[0], parts[1]) : null;
    }

    /// <summary>A timestamp, and nothing that walks out of the backups folder.</summary>
    public static bool IsValidId(string id) => id.Length == 15 && id[8] == '-' && id.All(c => char.IsAsciiDigit(c) || c == '-');

    private static string NewId() => DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);

    /// <summary>One database, custom format, streamed out of the shared Postgres container as the superuser.</summary>
    private async Task DumpAsync(string database, string path, CancellationToken ct)
    {
        await using var file = File.Create(path);
        var result = await shell.RunAsync("docker",
            ["exec", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_dump", "-U", Platform.PostgresUser, "-Fc", database],
            null, null, file, ct);
        if (!result.Ok) throw new InvalidOperationException($"pg_dump {database}: {result.Output}");
    }

    private static long Size(string dir) => new DirectoryInfo(dir).EnumerateFiles().Sum(f => f.Length);
}

/// <param name="Stale">No platform backup in the last 26 hours: the nightly one did not happen.</param>
public sealed record PlatformBackupsResponse(IReadOnlyList<BackupInfo> Backups, DateTimeOffset? LastAt, DateTimeOffset? LastOffsiteAt, bool Stale, bool OffsiteEnabled);

/// <summary>The platform's own databases, dumped and copied off the box: nightly before the tenants, and on demand.</summary>
public sealed class PlatformBackupService(BackupService backups, IServiceScopeFactory scopes, IOptions<PlatformOptions> options, ILogger<PlatformBackupService> logger)
{
    private readonly SemaphoreSlim _one = new(1, 1);

    public async Task<BackupInfo> RunAsync(CancellationToken ct)
    {
        await _one.WaitAsync(ct);
        try
        {
            using var scope = scopes.CreateScope();
            var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
            try
            {
                var info = await backups.CreatePlatformAsync(ct);
                var offsite = false;
                if (backups.OffsiteEnabled)
                {
                    info = await backups.OffsiteAsync(BackupService.PlatformSlug, info.Id, ct);
                    offsite = true;
                }
                backups.Prune(BackupService.PlatformSlug, options.Value.PlatformBackupsKeep);
                await audit.WriteAsync("platform.backup.done", null, new { info.Id, sizeMb = info.SizeBytes / (1024 * 1024), offsite }, ct, "backup");
                return info;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogError(ex, "Platform backup failed");
                await audit.WriteAsync("platform.backup.failed", null, new { error = ex.Message }, ct, "backup");
                throw;
            }
        }
        finally
        {
            _one.Release();
        }
    }

    public PlatformBackupsResponse Status()
    {
        var list = backups.List(BackupService.PlatformSlug);
        var last = list.FirstOrDefault()?.At;
        return new(list, last, list.Where(b => b.OffsiteAt is not null).Select(b => b.OffsiteAt).Max(), IsStale(last, DateTimeOffset.UtcNow), backups.OffsiteEnabled);
    }

    /// <summary>Pure, for the test: a nightly job that has not run in 26 hours missed a night.</summary>
    public static bool IsStale(DateTimeOffset? lastAt, DateTimeOffset now) => lastAt is null || now - lastAt > TimeSpan.FromHours(26);
}

/// <summary>
/// At three in the morning, platform time: the platform's own databases first
/// (inline, they are small), the archive pruned, then every running tenant
/// queued for a backup; the oldest go once there are more than kept.
/// </summary>
public sealed class NightlyBackupService(IServiceScopeFactory scopes, ProvisioningQueue queue, BackupService backups, PlatformBackupService platformBackups, IOptions<PlatformOptions> options, ILogger<NightlyBackupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var wait = UntilNextRun(DateTimeOffset.UtcNow, options.Value.TimeZone, options.Value.BackupHour);
            logger.LogInformation("Next nightly backup in {Wait}", wait);
            try
            {
                await Task.Delay(wait, stoppingToken);
                await EnqueueAllAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Nightly backup sweep failed");
            }
        }
    }

    internal async Task EnqueueAllAsync(CancellationToken ct)
    {
        // The platform's own first: a failure there is logged and audited, and the tenants still get theirs
        try { await platformBackups.RunAsync(ct); }
        catch (Exception ex) when (!ct.IsCancellationRequested) { logger.LogError(ex, "The platform backup failed; the tenants' go ahead"); }

        var pruned = backups.PruneArchive(options.Value.ArchiveKeepDays);
        if (pruned > 0) logger.LogInformation("{Count} archived backup(s) past {Days} days removed", pruned, options.Value.ArchiveKeepDays);

        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var running = await context.Tenants.AsNoTracking().Where(t => t.Status == TenantStatus.Running).ToListAsync(ct);

        // Before tonight's run: whoever runs the platform hears about a tenant whose last backup is older than two nights
        var stale = running
            .Select(t => (t.Slug, LastAt: backups.List(t.Slug).FirstOrDefault()?.At))
            .Where(x => x.LastAt is null || DateTimeOffset.UtcNow - x.LastAt > TimeSpan.FromDays(2))
            .ToList();
        if (stale.Count > 0 && !string.IsNullOrWhiteSpace(options.Value.Mail.OpsTo))
        {
            context.Outbox.Add(OutboxMail.From(MailTemplates.OpsBackupStale(stale, options.Value)));
            await context.SaveChangesAsync(ct);
        }

        foreach (var tenant in running)
        {
            await audit.WriteAsync("backup.nightly", tenant.Slug, null, ct, "backup");
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "backup"), ct);
        }
    }

    /// <summary>How long until the next <paramref name="hour"/> o'clock in <paramref name="timeZone"/> (on <paramref name="weekday"/>, when given); pure, for the test.</summary>
    public static TimeSpan UntilNextRun(DateTimeOffset nowUtc, string timeZone, int hour, DayOfWeek? weekday = null)
    {
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(timeZone); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { zone = TimeZoneInfo.Utc; }
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone);
        var next = new DateTimeOffset(local.Year, local.Month, local.Day, hour, 0, 0, local.Offset);
        if (next <= local) next = next.AddDays(1);
        while (weekday is { } day && next.DayOfWeek != day) next = next.AddDays(1);
        // The offset may change across the day boundary (summer time): ask the zone again
        var nextUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(next.DateTime, DateTimeKind.Unspecified), zone);
        var wait = nextUtc - nowUtc.UtcDateTime;
        return wait < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : wait;
    }
}

/// <summary>
/// Once a week, the proof that a backup restores: the customer whose newest
/// backup was verified longest ago gets it restored into a scratch tenant
/// (drill-{slug}, a demo that expires at once so the expiry sweep cleans up
/// even if this service dies mid-way), waited on until healthy, marked
/// verified, and destroyed. Skipped when the box has no room for a stack.
/// </summary>
public sealed class RestoreDrillService(IServiceScopeFactory scopes, ProvisioningQueue queue, BackupService backups, CapacityCache capacity, IOptions<PlatformOptions> options, ILogger<RestoreDrillService> logger) : BackgroundService
{
    private const string Source = "drill";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var drill = options.Value.RestoreDrill;
            var wait = NightlyBackupService.UntilNextRun(DateTimeOffset.UtcNow, options.Value.TimeZone, drill.Hour, drill.Weekday);
            logger.LogInformation("Next restore drill in {Wait}", wait);
            try
            {
                await Task.Delay(wait, stoppingToken);
                await RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Restore drill failed");
            }
        }
    }

    internal async Task RunAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();

        var customers = await context.Tenants.AsNoTracking().Where(t => t.Kind == TenantKind.Customer && t.Status == TenantStatus.Running).ToListAsync(ct);
        var candidates = customers.Select(t => (Tenant: t, Newest: backups.List(t.Slug).FirstOrDefault())).Where(c => c.Newest is not null).Select(c => (c.Tenant, c.Newest!)).ToList();
        var picked = Pick(candidates);
        if (picked is not { } source)
        {
            logger.LogInformation("Restore drill: nothing to verify");
            return;
        }

        var drillSlug = TenantNaming.DrillSlug(source.Tenant.Slug);
        if (!capacity.HasRoom)
        {
            await audit.WriteAsync("backup.drill.skipped", source.Tenant.Slug, new { source.Newest.Id, reason = "no room for a stack" }, ct, Source);
            return;
        }
        if (await context.Tenants.AnyAsync(t => t.Slug == drillSlug && t.Status != TenantStatus.Destroyed, ct))
        {
            await audit.WriteAsync("backup.drill.skipped", source.Tenant.Slug, new { source.Newest.Id, reason = $"{drillSlug} is still there" }, ct, Source);
            return;
        }

        // A Destroyed record under the same slug is reused; otherwise the drill is a demo that has already expired
        var existing = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == drillSlug, ct);
        var drill = existing ?? new Tenant { Slug = drillSlug };
        Shape(drill, source.Tenant, source.Newest, options.Value);
        if (existing is null) context.Tenants.Add(drill);
        await context.SaveChangesAsync(ct);
        await queue.EnqueueAsync(new ProvisioningJob(drill.Id, "provision"), ct);

        var started = DateTimeOffset.UtcNow;
        var deadline = started + TimeSpan.FromMinutes(options.Value.RestoreDrill.TimeoutMinutes);
        TenantStatus status;
        do
        {
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
            status = await context.Tenants.AsNoTracking().Where(t => t.Id == drill.Id).Select(t => t.Status).SingleAsync(ct);
        } while (status is not (TenantStatus.Running or TenantStatus.Failed) && DateTimeOffset.UtcNow < deadline);

        if (status == TenantStatus.Running)
        {
            backups.Update(source.Tenant.Slug, source.Newest.Id, b => b with { VerifiedAt = DateTimeOffset.UtcNow });
            await audit.WriteAsync("backup.drill.done", source.Tenant.Slug, new { source.Newest.Id, drillSlug, seconds = (int)(DateTimeOffset.UtcNow - started).TotalSeconds }, ct, Source);
        }
        else
        {
            var error = await context.Tenants.AsNoTracking().Where(t => t.Id == drill.Id).Select(t => t.LastError).SingleAsync(ct);
            await audit.WriteAsync("backup.drill.failed", source.Tenant.Slug, new { source.Newest.Id, drillSlug, error = error ?? $"still {status} after {options.Value.RestoreDrill.TimeoutMinutes} minutes" }, ct, Source);
        }
        // Whatever happened, the scratch stack goes; the worker is serial, so this runs after a provision still in flight
        await queue.EnqueueAsync(new ProvisioningJob(drill.Id, "destroy"), ct);
    }

    /// <summary>
    /// What the scratch tenant is: the source's shape and locale, restored
    /// from its newest backup, but never the source's owner. The welcome is
    /// marked sent before the stamp and the record is flagged, so the owner
    /// hears nothing and the demo sweep does not mail or stop it. Pure, for
    /// the test.
    /// </summary>
    public static void Shape(Tenant drill, Tenant source, BackupInfo newest, PlatformOptions platform)
    {
        drill.NameEn = $"Drill: {source.NameEn}";
        drill.NameAr = null;
        drill.Kind = TenantKind.Demo;
        drill.IsDrill = true;
        drill.Status = TenantStatus.Requested;
        drill.Seed = TenantSeed.None;
        drill.Country = source.Country;
        drill.Currency = source.Currency;
        drill.TimeZone = source.TimeZone;
        drill.DefaultLanguage = source.DefaultLanguage;
        // The realm gets an owner that is ours; the customer's address must not receive a password for a stack that is destroyed within the hour
        drill.OwnerEmail = string.IsNullOrWhiteSpace(platform.Mail.OpsTo) ? $"drill@{platform.Domain}" : platform.Mail.OpsTo.Trim().ToLowerInvariant();
        drill.WelcomeSentAt = DateTimeOffset.UtcNow;
        drill.IdentitySecret = TenantNaming.NewSecret();
        drill.ControlSecret = TenantNaming.NewSecret();
        drill.ImageTag = string.IsNullOrEmpty(newest.ImageTag) ? source.ImageTag : newest.ImageTag;
        drill.RestoreFrom = $"{source.Slug}/{newest.Id}";
        drill.ExpiresAt = DateTimeOffset.UtcNow;
        drill.Notes = "restore drill";
        drill.LastError = null;
    }

    /// <summary>The tenant whose newest backup has gone unverified longest; pure, for the test.</summary>
    public static (Tenant Tenant, BackupInfo Newest)? Pick(IReadOnlyList<(Tenant Tenant, BackupInfo Newest)> candidates)
        => candidates.Count == 0 ? null : candidates.OrderBy(c => c.Newest.VerifiedAt ?? DateTimeOffset.MinValue).ThenBy(c => c.Tenant.Slug, StringComparer.Ordinal).First();
}
