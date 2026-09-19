using System.Text.Json;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What the box has and what the stacks on it take, at one moment.</summary>
/// <param name="TenantsDiskFreeMb">Free space where the tenants' files and backups go.</param>
/// <param name="DockerUsedMb">What images, containers and volumes take, as docker system df counts it.</param>
public sealed record CapacitySnapshot(
    DateTimeOffset At,
    long MemTotalMb,
    long MemAvailableMb,
    double[] Load,
    int Cpus,
    long TenantsDiskFreeMb,
    long TenantsDiskTotalMb,
    long DockerUsedMb,
    long DockerReclaimableMb,
    IReadOnlyList<ProjectUsage> Projects);

/// <summary>Reads the box. Behind an interface so the dry run answers with a box that is not there.</summary>
public interface IHostCapacity
{
    Task<CapacitySnapshot> ProbeAsync(CancellationToken ct);
}

/// <summary>
/// The real box: /proc for memory and load (the control container has no
/// memory limit of its own, so /proc shows the host), the tenants root's
/// drive for disk, and docker for what the stacks weigh.
/// </summary>
public sealed class ProcHostCapacity(IShell shell, IOptions<PlatformOptions> options, ILogger<ProcHostCapacity> logger) : IHostCapacity
{
    public async Task<CapacitySnapshot> ProbeAsync(CancellationToken ct)
    {
        var (memTotal, memAvailable) = CapacityMath.ParseMeminfo(await ReadOrEmptyAsync("/proc/meminfo", ct));
        var load = CapacityMath.ParseLoadAvg(await ReadOrEmptyAsync("/proc/loadavg", ct));

        long diskFree = 0, diskTotal = 0;
        try
        {
            var root = Directory.Exists(options.Value.TenantsRoot) ? options.Value.TenantsRoot : Path.GetPathRoot(options.Value.TenantsRoot) ?? "/";
            var drive = new DriveInfo(root);
            diskFree = drive.AvailableFreeSpace / (1024 * 1024);
            diskTotal = drive.TotalSize / (1024 * 1024);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            logger.LogWarning(ex, "Could not read the tenants drive");
        }

        long dockerUsed = 0, dockerReclaimable = 0;
        var df = await shell.RunAsync("docker", ["system", "df", "--format", "{{json .}}"], null, ct);
        if (df.Ok)
        {
            foreach (var line in df.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    dockerUsed += CapacityMath.ParseDockerSizeMb(doc.RootElement.GetProperty("Size").GetString() ?? "");
                    dockerReclaimable += CapacityMath.ParseDockerSizeMb(doc.RootElement.GetProperty("Reclaimable").GetString() ?? "");
                }
                catch (Exception ex) when (ex is JsonException or KeyNotFoundException) { }
            }
        }

        var ps = await shell.RunAsync("docker", ["ps", "-a", "--format", "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}\t{{.State}}"], null, ct);
        var stats = await shell.RunAsync("docker", ["stats", "--no-stream", "--format", "{{json .}}"], null, ct);
        var projects = CapacityMath.Group(ps.Ok ? ps.Stdout : "", stats.Ok ? stats.Stdout : "");

        return new CapacitySnapshot(DateTimeOffset.UtcNow, memTotal, memAvailable, load, Environment.ProcessorCount,
            diskFree, diskTotal, dockerUsed, dockerReclaimable, projects);
    }

    private static async Task<string> ReadOrEmptyAsync(string path, CancellationToken ct)
    {
        try { return File.Exists(path) ? await File.ReadAllTextAsync(path, ct) : ""; }
        catch (IOException) { return ""; }
    }
}

/// <summary>Dry run: a 16 GB box with a stack's worth of memory taken per Running tenant.</summary>
public sealed class DryRunHostCapacity(IServiceScopeFactory scopes, IOptions<PlatformOptions> options) : IHostCapacity
{
    public async Task<CapacitySnapshot> ProbeAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var running = await context.Tenants.AsNoTracking().Where(t => t.Status == TenantStatus.Running).Select(t => t.Slug).ToListAsync(ct);
        var perStack = (long)(options.Value.StackFootprintMb * 0.9);
        var projects = running.Select(slug => new ProjectUsage(TenantNaming.Project(slug), TenantNaming.Services.Length + 1, TenantNaming.Services.Length + 1, perStack, 4.2)).ToList();
        var total = 16 * 1024L;
        var used = 2 * 1024L + running.Count * perStack;
        return new CapacitySnapshot(DateTimeOffset.UtcNow, total, Math.Max(0, total - used), [0.42, 0.51, 0.47], 4,
            120 * 1024L, 250 * 1024L, 9 * 1024L, 1 * 1024L, projects);
    }
}

/// <summary>The last snapshot, refreshed on a timer so the control app can poll without probing the box each time.</summary>
public sealed class CapacityCache(IHostCapacity host, IOptions<PlatformOptions> options)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    public CapacitySnapshot? Latest { get; private set; }

    public async Task<CapacitySnapshot> RefreshAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            Latest = await host.ProbeAsync(ct);
            return Latest;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>The cached snapshot, or a fresh one when there is none yet.</summary>
    public async Task<CapacitySnapshot> GetAsync(bool refresh, CancellationToken ct)
        => Latest is { } latest && !refresh ? latest : await RefreshAsync(ct);

    public int RoomFor(CapacitySnapshot snapshot)
        => CapacityMath.RoomFor(snapshot.MemAvailableMb, options.Value.ReserveMb, options.Value.StackFootprintMb);

    /// <summary>Whether another stack fits, on the last snapshot; true when the box has never been read (better a stamp than a guess).</summary>
    public bool HasRoom => Latest is null || RoomFor(Latest) > 0;
}

public sealed class CapacityMonitor(CapacityCache cache, IOptions<PlatformOptions> options, ILogger<CapacityMonitor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, options.Value.CapacityRefreshSeconds)));
        do
        {
            try
            {
                await cache.RefreshAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Could not read the box's capacity");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
