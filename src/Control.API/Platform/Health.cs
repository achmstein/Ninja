using System.Collections.Concurrent;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What the platform page says at the top in red: a lane that stopped, a drive that is nearly full, a stack that is down, a job that hangs. Keyed so a condition that clears goes away.</summary>
public sealed class PlatformWarnings
{
    private readonly ConcurrentDictionary<string, string> _warnings = new(StringComparer.Ordinal);

    public void Set(string key, string message) => _warnings[key] = message;

    public void Clear(string key) => _warnings.TryRemove(key, out _);

    public bool Has(string key) => _warnings.ContainsKey(key);

    public IReadOnlyList<string> All => _warnings.OrderBy(w => w.Key, StringComparer.Ordinal).Select(w => w.Value).ToList();
}

/// <summary>A lane whose worker has not gone round in minutes is dead; /health says so.</summary>
public sealed class WorkerHealthCheck(WorkerHeartbeat heartbeat) : IHealthCheck
{
    public static readonly TimeSpan Silence = TimeSpan.FromMinutes(2);

    /// <summary>Pure, for the test.</summary>
    public static bool IsAlive(DateTimeOffset? lastBeat, DateTimeOffset now) => lastBeat is { } at && now - at < Silence;

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var dead = Enum.GetValues<JobLane>().Where(lane => !IsAlive(heartbeat.LastBeat(lane), now)).ToList();
        return Task.FromResult(dead.Count == 0
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy($"No heartbeat from {string.Join(", ", dead)} for {Silence.TotalMinutes} minutes"));
    }
}

/// <summary>The tenants drive: unhealthy below the floor no backup or stamp may cross, degraded within twice it.</summary>
public sealed class DiskHealthCheck(CapacityCache capacity, IOptions<PlatformOptions> options) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        var snapshot = capacity.Latest;
        if (snapshot is null || snapshot.TenantsDiskTotalMb == 0) return Task.FromResult(HealthCheckResult.Healthy("not read yet"));
        var floor = options.Value.MinFreeDiskMb;
        var free = snapshot.TenantsDiskFreeMb;
        return Task.FromResult(
            free < floor ? HealthCheckResult.Unhealthy($"{free} MB free on the tenants drive, below the {floor} MB floor")
            : free < 2 * floor ? HealthCheckResult.Degraded($"{free} MB free on the tenants drive")
            : HealthCheckResult.Healthy());
    }
}

/// <summary>Degraded when the nightly platform backup missed a night; the process is fine, the safety net is not.</summary>
public sealed class PlatformBackupHealthCheck(PlatformBackupService backups) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
        => Task.FromResult(backups.Status().Stale ? HealthCheckResult.Degraded("no platform backup in the last 26 hours") : HealthCheckResult.Healthy());
}

/// <summary>Keycloak's own readiness on its management port: without it no stamp, no sign-in, no impersonation.</summary>
public sealed class KeycloakHealthCheck(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var client = httpClientFactory.CreateClient("keycloak");
            client.Timeout = TimeSpan.FromSeconds(5);
            using var response = await client.GetAsync(options.Value.KeycloakHealthUrl, ct);
            return response.IsSuccessStatusCode ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy($"Keycloak answered {(int)response.StatusCode}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return HealthCheckResult.Unhealthy($"Keycloak did not answer: {ex.Message}");
        }
    }
}

/// <summary>The arithmetic of reconciliation, apart from the box: which running tenants have no running containers, and which compose projects nobody's record explains.</summary>
public static class Reconciler
{
    public static (IReadOnlyList<string> StackDown, IReadOnlyList<string> Orphans) Compare(IReadOnlyList<(string Slug, TenantStatus Status)> records, IReadOnlyList<ProjectUsage> projects, string? platformProject = null)
    {
        var byProject = projects.ToDictionary(p => p.Project, StringComparer.Ordinal);
        var down = records
            .Where(r => r.Status == TenantStatus.Running)
            .Where(r => !byProject.TryGetValue(TenantNaming.Project(r.Slug), out var p) || p.Running == 0)
            .Select(r => r.Slug)
            .Order(StringComparer.Ordinal)
            .ToList();
        var known = records.Where(r => r.Status != TenantStatus.Destroyed).Select(r => TenantNaming.Project(r.Slug)).ToHashSet(StringComparer.Ordinal);
        var orphans = projects
            .Where(p => CapacityMath.IsStack(p.Project, platformProject) && !known.Contains(p.Project))
            .Select(p => p.Project)
            .Order(StringComparer.Ordinal)
            .ToList();
        return (down, orphans);
    }
}

/// <summary>
/// Once a minute: the drive against its floor, each lane's heartbeat, and
/// jobs running past their time; every hour, the record against what
/// docker actually runs. Each finding is a warning on the platform page and,
/// the first time it appears, an audit row and a mail to ops. Nothing is
/// changed on its own: a stack that is down is for someone to look at.
/// </summary>
public sealed class PlatformWatchdog(IServiceScopeFactory scopes, CapacityCache capacity, WorkerHeartbeat heartbeat, PlatformWarnings warnings, IOptions<PlatformOptions> options, ILogger<PlatformWatchdog> logger) : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan Reconcile = TimeSpan.FromHours(1);

    private readonly HashSet<string> _seen = new(StringComparer.Ordinal);
    private DateTimeOffset _lastReconcile = DateTimeOffset.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // The first capacity snapshot and the first heartbeats need a moment
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch (OperationCanceledException) { return; }
        using var timer = new PeriodicTimer(Tick);
        do
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogError(ex, "Watchdog tick failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    internal async Task TickAsync(CancellationToken ct)
    {
        var platform = options.Value;
        var now = DateTimeOffset.UtcNow;
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        var findings = new List<(string Key, string Warning, string Action, object Details, MailMessage? Mail)>();

        // The drive
        var snapshot = capacity.Latest;
        if (snapshot is { TenantsDiskTotalMb: > 0 } && snapshot.TenantsDiskFreeMb < platform.MinFreeDiskMb)
            findings.Add(("disk", $"{snapshot.TenantsDiskFreeMb} MB free on the tenants drive, below the {platform.MinFreeDiskMb} MB floor: no backup or stamp until space is freed",
                "platform.disk-low", new { freeMb = snapshot.TenantsDiskFreeMb, floorMb = platform.MinFreeDiskMb }, MailTemplates.OpsDiskLow(snapshot.TenantsDiskFreeMb, platform.MinFreeDiskMb, platform)));

        // The lanes
        foreach (var lane in Enum.GetValues<JobLane>())
            if (!WorkerHealthCheck.IsAlive(heartbeat.LastBeat(lane), now))
                findings.Add(($"worker:{lane}", $"The {lane} lane has not gone round for {WorkerHealthCheck.Silence.TotalMinutes} minutes; restart the control plane",
                    "platform.worker-dead", new { lane = lane.ToString() }, MailTemplates.OpsWorkerDead(lane.ToString(), platform)));

        // Jobs past their time
        var limit = now.AddMinutes(-platform.JobTimeoutMinutes);
        var stuck = await context.Jobs.AsNoTracking().Where(j => j.Status == JobStatus.Running && j.StartedAt != null && j.StartedAt < limit).ToListAsync(ct);
        if (stuck.Count > 0)
        {
            var slugs = await context.Tenants.AsNoTracking().Where(t => stuck.Select(j => j.TenantId).Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Slug, ct);
            foreach (var job in stuck)
            {
                var slug = slugs.GetValueOrDefault(job.TenantId, "?");
                var minutes = (int)(now - job.StartedAt!.Value).TotalMinutes;
                findings.Add(($"job:{job.Id}", $"{job.Action} on {slug} has been running for {minutes} minutes",
                    "job.stuck", new { job.Id, job.Action, slug, minutes }, MailTemplates.OpsJobStuck(slug, job.Action, minutes, platform)));
            }
        }

        // The record against the box, once an hour
        if (snapshot is not null && now - _lastReconcile >= Reconcile)
        {
            _lastReconcile = now;
            var records = await context.Tenants.AsNoTracking().Select(t => new ValueTuple<string, TenantStatus>(t.Slug, t.Status)).ToListAsync(ct);
            var (down, orphans) = Reconciler.Compare(records, snapshot.Projects, snapshot.PlatformProject);
            foreach (var slug in down)
                findings.Add(($"down:{slug}", $"{slug} is Running on the record but none of its containers run", "tenant.stack-down", new { slug }, MailTemplates.OpsStackDown(slug, platform)));
            foreach (var project in orphans)
                findings.Add(($"orphan:{project}", $"Compose project {project} runs on the box but no tenant record explains it", "platform.orphan-stack", new { project }, null));
        }

        // What cleared, clears; what is new is said once
        var current = findings.Select(f => f.Key).ToHashSet(StringComparer.Ordinal);
        foreach (var key in _seen.Where(k => !current.Contains(k) && !k.StartsWith("down:", StringComparison.Ordinal) && !k.StartsWith("orphan:", StringComparison.Ordinal)).ToList())
        {
            _seen.Remove(key);
            warnings.Clear(key);
        }
        if (now - _lastReconcile < Tick)
        {
            // A reconciliation ran this tick: its findings replace the last hour's
            foreach (var key in _seen.Where(k => (k.StartsWith("down:", StringComparison.Ordinal) || k.StartsWith("orphan:", StringComparison.Ordinal)) && !current.Contains(k)).ToList())
            {
                _seen.Remove(key);
                warnings.Clear(key);
            }
        }
        var mailed = false;
        foreach (var (key, warning, action, details, mail) in findings)
        {
            warnings.Set(key, warning);
            if (!_seen.Add(key)) continue;
            logger.LogWarning("{Warning}", warning);
            await audit.WriteAsync(action, details is { } d && d.GetType().GetProperty("slug")?.GetValue(d) is string s ? s : null, details, ct, "watchdog");
            if (mail is not null && !string.IsNullOrWhiteSpace(platform.Mail.OpsTo))
            {
                context.Outbox.Add(OutboxMail.From(mail));
                mailed = true;
            }
        }
        if (mailed) await context.SaveChangesAsync(ct);
    }
}
