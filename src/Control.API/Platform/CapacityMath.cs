using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Ninja.Control.API.Platform;

/// <summary>What one compose project's containers weigh right now.</summary>
public sealed record ProjectUsage(string Project, int Containers, int Running, long MemoryMb, double CpuPercent);

/// <summary>The arithmetic of a box's room, on text the host and docker print; pure, so it is testable without a box.</summary>
public static partial class CapacityMath
{
    /// <summary>MemTotal and MemAvailable from /proc/meminfo, in MB; zeros when a line is missing.</summary>
    public static (long TotalMb, long AvailableMb) ParseMeminfo(string text)
    {
        long total = 0, available = 0;
        foreach (var line in text.Split('\n'))
        {
            var m = MeminfoLine().Match(line);
            if (!m.Success) continue;
            var kb = long.Parse(m.Groups["kb"].Value, CultureInfo.InvariantCulture);
            if (m.Groups["key"].Value == "MemTotal") total = kb / 1024;
            else if (m.Groups["key"].Value == "MemAvailable") available = kb / 1024;
        }
        return (total, available);
    }

    /// <summary>The three load averages from /proc/loadavg.</summary>
    public static double[] ParseLoadAvg(string text)
    {
        var parts = text.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var load = new double[3];
        for (var i = 0; i < 3 && i < parts.Length; i++)
            double.TryParse(parts[i], NumberStyles.Float, CultureInfo.InvariantCulture, out load[i]);
        return load;
    }

    /// <summary>A size as docker prints it ("1.5GiB", "512MB", "3.2kB", "0B", "1.2GB (40%)") in MB.</summary>
    public static long ParseDockerSizeMb(string text)
    {
        var m = DockerSize().Match(text.Trim());
        if (!m.Success) return 0;
        var value = double.Parse(m.Groups["n"].Value, CultureInfo.InvariantCulture);
        var unit = m.Groups["u"].Value.ToLowerInvariant();
        double bytes = unit switch
        {
            "b" => value,
            "kb" => value * 1000,
            "kib" => value * 1024,
            "mb" => value * 1000 * 1000,
            "mib" => value * 1024 * 1024,
            "gb" => value * 1000 * 1000 * 1000,
            "gib" => value * 1024 * 1024 * 1024,
            "tb" => value * 1000d * 1000 * 1000 * 1000,
            "tib" => value * 1024d * 1024 * 1024 * 1024,
            _ => 0,
        };
        return (long)Math.Round(bytes / (1024 * 1024));
    }

    /// <summary>
    /// The usage per compose project. <paramref name="psLines"/> is
    /// <c>docker ps -a --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.State}}'</c>;
    /// <paramref name="statsJsonLines"/> is <c>docker stats --no-stream --format '{{json .}}'</c>
    /// (one object per running container: Name, CPUPerc, MemUsage). Stats carry
    /// no labels, so the two are joined on the container name.
    /// </summary>
    public static IReadOnlyList<ProjectUsage> Group(string psLines, string statsJsonLines)
    {
        var stats = new Dictionary<string, (long Mb, double Cpu)>(StringComparer.Ordinal);
        foreach (var line in statsJsonLines.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;
                var name = root.GetProperty("Name").GetString() ?? "";
                var mem = root.TryGetProperty("MemUsage", out var m) ? m.GetString() ?? "" : "";
                var cpu = root.TryGetProperty("CPUPerc", out var c) ? c.GetString() ?? "" : "";
                stats[name] = (ParseDockerSizeMb(mem.Split('/')[0]), ParsePercent(cpu));
            }
            catch (JsonException) { }
        }

        var byProject = new Dictionary<string, (int Containers, int Running, long Mb, double Cpu)>(StringComparer.Ordinal);
        foreach (var line in psLines.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var cols = line.Split('\t');
            if (cols.Length < 2) continue;
            var name = cols[0].Trim();
            var project = cols[1].Trim();
            if (project.Length == 0) continue;
            var running = cols.Length > 2 && string.Equals(cols[2].Trim(), "running", StringComparison.OrdinalIgnoreCase);
            var (mb, cpu) = stats.TryGetValue(name, out var s) ? s : (0, 0);
            var acc = byProject.GetValueOrDefault(project);
            byProject[project] = (acc.Containers + 1, acc.Running + (running ? 1 : 0), acc.Mb + mb, acc.Cpu + cpu);
        }

        return byProject
            .Select(kv => new ProjectUsage(kv.Key, kv.Value.Containers, kv.Value.Running, kv.Value.Mb, Math.Round(kv.Value.Cpu, 1)))
            .OrderBy(p => p.Project, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>How many more stacks fit: what is free beyond the reserve, in footprints, never negative.</summary>
    public static int RoomFor(long availableMb, int reserveMb, int footprintMb)
        => footprintMb <= 0 ? 0 : Math.Max(0, (int)Math.Floor((availableMb - reserveMb) / (double)footprintMb));

    /// <summary>The platform's own connections (Keycloak's pool, the control plane) that every estimate starts from.</summary>
    public const int PlatformConnections = 40;

    /// <summary>What the shared Postgres may be asked for: every running stack's eleven pools full, plus the platform's own.</summary>
    public static int ConnectionsEstimate(int runningStacks, int poolSize)
        => PlatformConnections + runningStacks * TenantNaming.Databases.Length * poolSize;

    /// <summary>How many more stacks fit in the connection budget, never negative.</summary>
    public static int ConnectionRoomFor(int runningStacks, int poolSize, int maxConnections)
    {
        var perStack = TenantNaming.Databases.Length * poolSize;
        return perStack <= 0 ? 0 : Math.Max(0, (maxConnections - ConnectionsEstimate(runningStacks, poolSize)) / perStack);
    }

    /// <summary>Whether the tenants drive can take one more stack's worth of backups and uploads: the floor plus a quarter of a footprint above it. A drive that was never read (total 0) passes.</summary>
    public static bool DiskRoom(long freeMb, long totalMb, int floorMb, int footprintMb)
        => totalMb == 0 || freeMb >= floorMb + footprintMb / 4;

    /// <summary>The compose projects that are tenant stacks with something running: ninja-{slug}, not the platform's own project.</summary>
    public static int RunningStacks(IEnumerable<ProjectUsage> projects)
        => projects.Count(p => p.Project.StartsWith("ninja-", StringComparison.Ordinal) && p.Running > 0);

    private static double ParsePercent(string text)
        => double.TryParse(text.Trim().TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : 0;

    [GeneratedRegex(@"^(?<key>MemTotal|MemAvailable):\s+(?<kb>\d+)\s*kB")]
    private static partial Regex MeminfoLine();

    [GeneratedRegex(@"^(?<n>\d+(?:\.\d+)?)\s*(?<u>[kKmMgGtT]?i?[bB])")]
    private static partial Regex DockerSize();
}
