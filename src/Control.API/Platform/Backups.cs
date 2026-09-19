using System.Formats.Tar;
using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>One backup of a tenant: its eleven databases and its uploads, under {tenants}/{slug}/backups/{id}/.</summary>
public sealed record BackupInfo(string Id, DateTimeOffset At, long SizeBytes, IReadOnlyList<string> Databases, bool HasUploads, string ImageTag);

/// <summary>
/// Dumps and restores through the shared Postgres container and a throwaway
/// alpine for the uploads volume, everything streamed: the tenants root may
/// be a named volume (it is on a laptop), so nothing is bind-mounted.
/// </summary>
public sealed class BackupService(IShell shell, IOptions<PlatformOptions> options, ILogger<BackupService> logger)
{
    private const string Manifest = "manifest.json";
    private const string Uploads = "uploads.tar.gz";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private PlatformOptions Platform => options.Value;

    public string Root(string slug) => Path.Combine(Platform.TenantsRoot, slug, "backups");

    public string Dir(string slug, string id) => Path.Combine(Root(slug), id);

    public async Task<BackupInfo> CreateAsync(Tenant tenant, CancellationToken ct)
    {
        var id = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        var dir = Dir(tenant.Slug, id);
        Directory.CreateDirectory(dir);
        try
        {
            foreach (var db in TenantNaming.Databases)
            {
                await using var file = File.Create(Path.Combine(dir, $"{db}.dump"));
                var result = await shell.RunAsync("docker",
                    ["exec", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_dump", "-U", Platform.PostgresUser, "-Fc", TenantNaming.Database(tenant.Slug, db)],
                    null, null, file, ct);
                if (!result.Ok) throw new InvalidOperationException($"pg_dump {db}: {result.Output}");
            }

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

            var info = new BackupInfo(id, DateTimeOffset.UtcNow, Size(dir), TenantNaming.Databases, hasUploads, tenant.ImageTag);
            await File.WriteAllTextAsync(Path.Combine(dir, Manifest), JsonSerializer.Serialize(info, Json), ct);
            return info;
        }
        catch
        {
            Directory.Delete(dir, recursive: true);
            throw;
        }
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
        foreach (var db in TenantNaming.Databases)
        {
            var dump = Path.Combine(dir, $"{db}.dump");
            if (!File.Exists(dump)) throw new FileNotFoundException($"{db}.dump is missing from backup {id}");
            await using var file = File.OpenRead(dump);
            var result = await shell.RunAsync("docker",
                ["exec", "-i", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_restore", "-U", Platform.PostgresUser, "--no-owner", "--clean", "--if-exists", "-d", TenantNaming.Database(into.Slug, db)],
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

    /// <summary>"{slug}/{id}", as a tenant remembers what it is being restored from.</summary>
    public static (string Slug, string Id)? ParseRestoreFrom(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var parts = value.Split('/');
        return parts.Length == 2 && TenantNaming.IsValidSlug(parts[0]) && IsValidId(parts[1]) ? (parts[0], parts[1]) : null;
    }

    /// <summary>A timestamp, and nothing that walks out of the backups folder.</summary>
    public static bool IsValidId(string id) => id.Length == 15 && id[8] == '-' && id.All(c => char.IsAsciiDigit(c) || c == '-');

    private static long Size(string dir) => new DirectoryInfo(dir).EnumerateFiles().Sum(f => f.Length);
}

/// <summary>Every running tenant is backed up at three in the morning, platform time; the oldest go once there are more than kept.</summary>
public sealed class NightlyBackupService(IServiceScopeFactory scopes, ProvisioningQueue queue, IOptions<PlatformOptions> options, ILogger<NightlyBackupService> logger) : BackgroundService
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
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var running = await context.Tenants.AsNoTracking().Where(t => t.Status == TenantStatus.Running).ToListAsync(ct);
        foreach (var tenant in running)
        {
            await audit.WriteAsync("backup.nightly", tenant.Slug, null, ct, "backup");
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "backup"), ct);
        }
    }

    /// <summary>How long until the next <paramref name="hour"/> o'clock in <paramref name="timeZone"/>; pure, for the test.</summary>
    public static TimeSpan UntilNextRun(DateTimeOffset nowUtc, string timeZone, int hour)
    {
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(timeZone); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { zone = TimeZoneInfo.Utc; }
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone);
        var next = new DateTimeOffset(local.Year, local.Month, local.Day, hour, 0, 0, local.Offset);
        if (next <= local) next = next.AddDays(1);
        // The offset may change across the day boundary (summer time): ask the zone again
        var nextUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(next.DateTime, DateTimeKind.Unspecified), zone);
        var wait = nextUtc - nowUtc.UtcDateTime;
        return wait < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : wait;
    }
}
