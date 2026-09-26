using System.Collections.Concurrent;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What a caller asks for; the row it becomes carries the rest.</summary>
/// <param name="ImageTag">For an upgrade: the tag to move to (null keeps the record's).</param>
/// <param name="CanaryId">For a fleet upgrade: the tenant that went first; the rest run only while it stands Running on the tag.</param>
public sealed record ProvisioningJob(Guid TenantId, string Action, string? ImageTag = null, Guid? CanaryId = null)
{
    /// <summary>Backups sit beside a stamp; everything else is a stamp or touches the stack.</summary>
    public static JobLane LaneOf(string action) => action == "backup" ? JobLane.Backup : JobLane.Stamp;

    /// <summary>What an admin or a sweep needs now goes before a stamp already waiting; a backup after both.</summary>
    public static int PriorityOf(string action) => action switch
    {
        "stop" or "suspend" or "destroy" or "start" or "resume" or "edge" or "entitlements" => 0,
        "backup" => 20,
        _ => 10,
    };
}

/// <summary>The queue, on the record. One worker per lane on one box: claiming is a read then a save, nothing more.</summary>
public sealed class ProvisioningQueue(IServiceScopeFactory scopes, IHttpContextAccessor http, ILogger<ProvisioningQueue> logger)
{
    private readonly ConcurrentDictionary<JobLane, SemaphoreSlim> _signals = new();

    private SemaphoreSlim Signal(JobLane lane) => _signals.GetOrAdd(lane, _ => new SemaphoreSlim(0));

    /// <summary>
    /// A row for the job, unless the same one (tenant, action, tag) is
    /// already waiting: a sweep that looks again before the worker got to
    /// it, or a second click, adds nothing. Returns the row's id.
    /// </summary>
    public async ValueTask<long> EnqueueAsync(ProvisioningJob job, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var waiting = await context.Jobs
            .Where(j => j.TenantId == job.TenantId && j.Action == job.Action && j.ImageTag == job.ImageTag && j.Status == JobStatus.Queued)
            .Select(j => (long?)j.Id)
            .FirstOrDefaultAsync(ct);
        if (waiting is { } id)
        {
            logger.LogInformation("{Action} for {TenantId} is already queued as job {Id}", job.Action, job.TenantId, id);
            return id;
        }

        var (actor, _, _) = AuditWriter.Attribute(http.HttpContext?.User, null);
        var row = new Job
        {
            TenantId = job.TenantId,
            Action = job.Action,
            ImageTag = job.ImageTag,
            CanaryId = job.CanaryId,
            Lane = ProvisioningJob.LaneOf(job.Action),
            Priority = ProvisioningJob.PriorityOf(job.Action),
            RequestedBy = actor,
        };
        context.Jobs.Add(row);
        await context.SaveChangesAsync(ct);
        Signal(row.Lane).Release();
        return row.Id;
    }

    /// <summary>
    /// The next job for the lane, marked Running; null when nothing is
    /// ready. A backup waits while its tenant is mid-stamp (a dump during a
    /// migration is no backup); the stamp lane takes whatever is first.
    /// </summary>
    public async Task<Job?> ClaimAsync(JobLane lane, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var now = DateTimeOffset.UtcNow;
        var ready = context.Jobs
            .Where(j => j.Status == JobStatus.Queued && j.Lane == lane && (j.NotBefore == null || j.NotBefore <= now));
        if (lane == JobLane.Backup)
        {
            var busy = ProvisioningWorker.Transitional;
            ready = ready.Where(j => !context.Tenants.Any(t => t.Id == j.TenantId && busy.Contains(t.Status)));
        }
        var job = await ready.OrderBy(j => j.Priority).ThenBy(j => j.Id).FirstOrDefaultAsync(ct);
        if (job is null) return null;
        job.Status = JobStatus.Running;
        job.StartedAt = now;
        job.Attempts++;
        await context.SaveChangesAsync(ct);
        return job;
    }

    public async Task CompleteAsync(long id, string? error, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var job = await context.Jobs.SingleOrDefaultAsync(j => j.Id == id, ct);
        if (job is null) return;
        job.Status = error is null ? JobStatus.Done : JobStatus.Failed;
        job.Error = error is null ? null : error.Length <= 4000 ? error : error[..4000];
        job.FinishedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync(ct);
    }

    /// <summary>A queued job is taken off the line; a running one cannot be. False when there is no such queued job.</summary>
    public async Task<bool> CancelAsync(long id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var job = await context.Jobs.SingleOrDefaultAsync(j => j.Id == id && j.Status == JobStatus.Queued, ct);
        if (job is null) return false;
        job.Status = JobStatus.Cancelled;
        job.FinishedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>Waits for a new job on the lane, or the interval, whichever first.</summary>
    public Task WaitAsync(JobLane lane, TimeSpan atMost, CancellationToken ct) => Signal(lane).WaitAsync(atMost, ct);

    /// <summary>
    /// After a restart: a job that was Running when the process died goes
    /// back on the line once (every step is idempotent), and a second
    /// interruption ends it. A tenant left mid-way with nothing queued for it
    /// is marked Failed with the reason, so the control app shows a retry
    /// rather than a stamp that never finishes.
    /// </summary>
    public async Task<(int Requeued, int Abandoned, int TenantsFailed)> RecoverAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditWriter>();
        int requeued = 0, abandoned = 0, failed = 0;

        foreach (var job in await context.Jobs.Where(j => j.Status == JobStatus.Running).ToListAsync(ct))
        {
            if (job.Attempts < 2)
            {
                job.Status = JobStatus.Queued;
                job.StartedAt = null;
                job.Error = "interrupted by a restart; queued again";
                requeued++;
            }
            else
            {
                job.Status = JobStatus.Failed;
                job.FinishedAt = DateTimeOffset.UtcNow;
                job.Error = "interrupted by a restart twice";
                abandoned++;
            }
        }
        await context.SaveChangesAsync(ct);

        var transitional = ProvisioningWorker.Transitional;
        var stuck = await context.Tenants
            .Where(t => transitional.Contains(t.Status))
            .Where(t => !context.Jobs.Any(j => j.TenantId == t.Id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running)))
            .ToListAsync(ct);
        foreach (var tenant in stuck)
        {
            var was = tenant.Status;
            tenant.Status = TenantStatus.Failed;
            tenant.LastError = $"interrupted by a restart while {was}";
            failed++;
            await audit.WriteAsync("tenant.interrupted", tenant.Slug, new { was = was.ToString() }, ct, "provisioner");
        }
        await context.SaveChangesAsync(ct);

        if (requeued + abandoned + failed > 0)
            logger.LogWarning("Recovery: {Requeued} job(s) queued again, {Abandoned} abandoned, {Failed} tenant(s) marked failed", requeued, abandoned, failed);
        return (requeued, abandoned, failed);
    }
}

/// <summary>When each lane's worker last went round; a lane silent for minutes is a dead worker, which the health check says.</summary>
public sealed class WorkerHeartbeat
{
    private readonly ConcurrentDictionary<JobLane, DateTimeOffset> _last = new();

    public void Beat(JobLane lane) => _last[lane] = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastBeat(JobLane lane) => _last.TryGetValue(lane, out var at) ? at : null;
}

/// <summary>Runs the recovery before any worker starts: a hosted service that does its work in StartAsync, which the host awaits in registration order.</summary>
public sealed class JobRecoveryService(ProvisioningQueue queue) : IHostedService
{
    public Task StartAsync(CancellationToken ct) => queue.RecoverAsync(ct);

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

/// <summary>Claims and runs one job at a time for its lane; never dies on a job.</summary>
public abstract class ProvisioningWorker(JobLane lane, ProvisioningQueue queue, IServiceScopeFactory scopes, UpdateCache updates, WorkerHeartbeat heartbeat, ILogger logger) : BackgroundService
{
    /// <summary>The statuses a job leaves a tenant in while it works; a job that dies mid-way must not leave one there.</summary>
    internal static readonly TenantStatus[] Transitional = [TenantStatus.Provisioning, TenantStatus.Upgrading, TenantStatus.Destroying];

    private static readonly TimeSpan Poll = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            heartbeat.Beat(lane);
            Job? job;
            try
            {
                job = await queue.ClaimAsync(lane, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "{Lane}: could not read the queue", lane);
                job = null;
            }
            if (job is null)
            {
                try { await queue.WaitAsync(lane, Poll, stoppingToken); }
                catch (OperationCanceledException) { }
                continue;
            }

            logger.LogInformation("{Lane} job {Id}: {Action} {TenantId}", lane, job.Id, job.Action, job.TenantId);
            string? error = null;
            using (var scope = scopes.CreateScope())
            {
                try
                {
                    await RunAsync(scope.ServiceProvider.GetRequiredService<Provisioner>(), job, stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    // Every job catches its own failures; what reaches here is a tenant row that is gone, a bug, or a
                    // cancellation that was not ours. The queue must outlive it, and the tenant must not stay "in progress".
                    logger.LogError(ex, "{Action} {TenantId} crashed", job.Action, job.TenantId);
                    error = ex.Message;
                    await MarkCrashedAsync(scope.ServiceProvider, job, ex, stoppingToken);
                }
            }
            if (stoppingToken.IsCancellationRequested) return;
            try { await queue.CompleteAsync(job.Id, error, stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogError(ex, "Could not close job {Id}", job.Id); }
            // Whatever the job did to the stack, the "behind" view is read again on the monitor's next tick
            updates.Invalidate();
        }
    }

    private static Task RunAsync(Provisioner provisioner, Job job, CancellationToken ct) => job.Action switch
    {
        "provision" => provisioner.ProvisionAsync(job.TenantId, ct),
        "destroy" => provisioner.DestroyAsync(job.TenantId, ct),
        "edge" => provisioner.EdgeAsync(job.TenantId, ct),
        "backup" => provisioner.BackupAsync(job.TenantId, ct),
        "secure" => provisioner.SecureAsync(job.TenantId, rotate: false, ct),
        "rotate" => provisioner.SecureAsync(job.TenantId, rotate: true, ct),
        "entitlements" => provisioner.EntitlementsAsync(job.TenantId, ct),
        "upgrade" => provisioner.UpgradeAsync(job.TenantId, job.ImageTag, job.CanaryId, ct),
        "rollback" => provisioner.RollbackAsync(job.TenantId, ct),
        "demo-data" => provisioner.DemoDataAsync(job.TenantId, ct),
        _ => provisioner.ComposeAsync(job.TenantId, job.Action, ct),
    };

    private async Task MarkCrashedAsync(IServiceProvider services, Job job, Exception ex, CancellationToken ct)
    {
        try
        {
            var context = services.GetRequiredService<ControlContext>();
            var audit = services.GetRequiredService<IAuditWriter>();
            var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Id == job.TenantId, ct);
            if (tenant is not null && Transitional.Contains(tenant.Status))
            {
                tenant.Status = TenantStatus.Failed;
                tenant.LastError = $"{job.Action} crashed: {ex.Message}";
                await context.SaveChangesAsync(ct);
            }
            await audit.WriteAsync("job.crashed", tenant?.Slug, new { job.Id, job.Action, error = ex.Message }, ct, "provisioner");
        }
        catch (Exception inner) when (!ct.IsCancellationRequested)
        {
            logger.LogError(inner, "Could not record the crash of {Action} {TenantId}", job.Action, job.TenantId);
        }
    }
}

public sealed class StampWorker(ProvisioningQueue queue, IServiceScopeFactory scopes, UpdateCache updates, WorkerHeartbeat heartbeat, ILogger<StampWorker> logger)
    : ProvisioningWorker(JobLane.Stamp, queue, scopes, updates, heartbeat, logger);

public sealed class BackupWorker(ProvisioningQueue queue, IServiceScopeFactory scopes, UpdateCache updates, WorkerHeartbeat heartbeat, ILogger<BackupWorker> logger)
    : ProvisioningWorker(JobLane.Backup, queue, scopes, updates, heartbeat, logger);
