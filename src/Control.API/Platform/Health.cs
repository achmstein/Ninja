using System.Collections.Concurrent;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform.Nodes;

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
public sealed class PlatformWatchdog(IServiceScopeFactory scopes, CapacityCache capacity, WorkerHeartbeat heartbeat, PlatformWarnings warnings, INodes nodes, IOptions<PlatformOptions> options, ILogger<PlatformWatchdog> logger) : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan Reconcile = TimeSpan.FromHours(1);

    private readonly HashSet<string> _seen = new(StringComparer.Ordinal);
    private DateTimeOffset _lastReconcile = DateTimeOffset.MinValue;

    /// <summary>How many ticks in a row each node's agent has not answered; three, and the node is Unreachable.</summary>
    private readonly Dictionary<int, int> _missed = [];

    internal const int MissesBeforeUnreachable = 3;

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

    /// <summary>
    /// Each node beyond this box, pinged. A node that has missed three in a row goes Unreachable (a warning, an
    /// audit row and one mail); one that answers again comes back Cordoned, for someone to look at and make
    /// active. Returns the nodes that are Unreachable now.
    /// </summary>
    private async Task<HashSet<int>> WatchNodesAsync(ControlContext context, IAuditWriter audit,
        List<(string Key, string Warning, string Action, object Details, MailMessage? Mail)> findings, PlatformOptions platform, CancellationToken ct)
    {
        var unreachable = new HashSet<int>();
        var agents = await context.Nodes.Where(n => n.Kind == NodeKind.Agent && n.Status != NodeStatus.Retired && n.AgentUrl != null).ToListAsync(ct);
        foreach (var node in agents)
        {
            bool answered;
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(15));
                var ping = await nodes.For(node.Id).PingAsync(timeout.Token);
                answered = true;
                node.LastSeenAt = DateTimeOffset.UtcNow;
                node.AgentVersion = ping.Version;
                node.LastError = ping.Docker ? null : $"docker: {ping.Error}";
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                answered = false;
                node.LastError = ex.Message;
            }

            if (answered)
            {
                _missed.Remove(node.Id);
                if (node.Status == NodeStatus.Unreachable)
                {
                    node.Status = NodeStatus.Cordoned;
                    await audit.WriteAsync("node.answering", null, new { node.Id, node.Name }, ct, "watchdog");
                }
                continue;
            }

            var missed = _missed[node.Id] = _missed.GetValueOrDefault(node.Id) + 1;
            if (missed >= MissesBeforeUnreachable && node.Status != NodeStatus.Unreachable)
            {
                node.Status = NodeStatus.Unreachable;
                logger.LogWarning("{Node} has not answered {Missed} times: Unreachable", node.Name, missed);
            }
            if (node.Status == NodeStatus.Unreachable)
            {
                unreachable.Add(node.Id);
                var tenants = await context.Tenants.CountAsync(t => t.NodeId == node.Id && t.Status != TenantStatus.Destroyed, ct);
                findings.Add(($"node:{node.Name}", $"{node.Name} does not answer: its {tenants} tenant(s) may be down and nothing there can be changed",
                    "node.unreachable", new { node.Id, node.Name, tenants }, MailTemplates.OpsNodeUnreachable(node.Name, tenants, platform)));
            }
        }
        await context.SaveChangesAsync(ct);
        return unreachable;
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

        // The nodes beyond this box: each agent pinged; three silent ticks in a row and the node is Unreachable,
        // its tenants said to be at risk. Nothing moves on its own: a node that is only cut off still runs its stacks
        var unreachable = await WatchNodesAsync(context, audit, findings, platform, ct);

        // The record against each node, once an hour
        if (snapshot is not null && now - _lastReconcile >= Reconcile)
        {
            _lastReconcile = now;
            // The records first, then docker as it is now: a stack being destroyed is still
            // Destroying on the record, and a Destroyed one's containers went before its
            // record said so. A snapshot from minutes ago would call a just-destroyed stack
            // an orphan for the hour until the next reconciliation
            var records = await context.Tenants.AsNoTracking().Select(t => new { t.Slug, t.Status, t.NodeId }).ToListAsync(ct);
            var box = await capacity.RefreshAsync(ct);
            var unread = (await capacity.RefreshAgentsAsync(ct)).Select(f => f.Node.Id).ToHashSet();
            var readings = new List<(int NodeId, string? Name, CapacitySnapshot Box)> { (Node.HomeId, null, box) };
            foreach (var node in nodes.Known.Where(n => n.Kind == NodeKind.Agent && n.Status != NodeStatus.Retired))
                if (!unread.Contains(node.Id) && !unreachable.Contains(node.Id) && capacity.For(node.Id) is { } reading)
                    readings.Add((node.Id, node.Name, reading));
            foreach (var (nodeId, name, reading) in readings)
            {
                // A node's tenants against that node's stacks; one that could not be read says nothing about its tenants
                var here = records.Where(r => r.NodeId == nodeId).Select(r => (r.Slug, r.Status)).ToList();
                var (down, orphans) = Reconciler.Compare(here, reading.Projects, reading.PlatformProject);
                var on = name is null ? "the box" : name;
                foreach (var slug in down)
                    findings.Add(($"down:{slug}", $"{slug} is Running on the record but none of its containers run on {on}", "tenant.stack-down", new { slug, node = on }, MailTemplates.OpsStackDown(slug, platform)));
                foreach (var project in orphans)
                    findings.Add(($"orphan:{project}", $"Compose project {project} runs on {on} but no tenant record there explains it", "platform.orphan-stack", new { project, node = on }, null));
            }
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
