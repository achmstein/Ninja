using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ninja.Control.NodeRuntime;

/// <summary>What the box has and what the stacks on it take, at one moment.</summary>
/// <param name="TenantsDiskFreeMb">Free space where the tenants' files and backups go.</param>
/// <param name="DockerUsedMb">What images, containers and volumes take, as docker system df counts it.</param>
/// <param name="PlatformProject">The compose project the platform's own containers run under (ninja in production, ninja-local on a laptop), read off the box; null when docker did not answer.</param>
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
    IReadOnlyList<ProjectUsage> Projects,
    string? PlatformProject = null);

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
public sealed class ProcHostCapacity(IShell shell, IOptions<NodeSettings> options, ILogger<ProcHostCapacity> logger) : IHostCapacity
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

        var ps = await shell.RunAsync("docker", ["ps", "-a", "--format", "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}\t{{.State}}\t{{.Status}}"], null, ct);
        var stats = await shell.RunAsync("docker", ["stats", "--no-stream", "--format", "{{json .}}"], null, ct);
        var projects = CapacityMath.Group(ps.Ok ? ps.Stdout : "", stats.Ok ? stats.Stdout : "");
        // Which of those projects is the platform itself: the one its own Postgres runs under
        var platformProject = ps.Ok ? CapacityMath.ProjectOf(ps.Stdout, options.Value.PostgresContainer) : null;

        return new CapacitySnapshot(DateTimeOffset.UtcNow, memTotal, memAvailable, load, Environment.ProcessorCount,
            diskFree, diskTotal, dockerUsed, dockerReclaimable, projects, platformProject);
    }

    private static async Task<string> ReadOrEmptyAsync(string path, CancellationToken ct)
    {
        try { return File.Exists(path) ? await File.ReadAllTextAsync(path, ct) : ""; }
        catch (IOException) { return ""; }
    }
}
