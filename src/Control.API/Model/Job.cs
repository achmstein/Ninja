namespace Ninja.Control.API.Model;

/// <summary>
/// The two lines work stands in. Stamps (compose up and down, upgrades)
/// go one at a time: docker compose on one box does not like parallel
/// stamps. A backup is a dump and a tar, which sit beside a stamp without
/// trouble, so they have a line of their own and a nightly run never
/// holds a stop or a suspension.
/// </summary>
public enum JobLane
{
    Stamp = 0,
    Backup = 1,
}

public enum JobStatus
{
    Queued = 0,
    Running = 1,
    Done = 2,
    Failed = 3,
    Cancelled = 4,
}

/// <summary>
/// One unit of work on a tenant, on the record rather than in memory: a
/// restart of the control plane loses nothing, what is waiting can be seen
/// and cancelled, and a job that was interrupted is picked up again.
/// </summary>
public class Job
{
    public long Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>provision, destroy, stop, start, suspend, resume, upgrade, rollback, secure, rotate, entitlements, edge, backup.</summary>
    public string Action { get; set; } = "";

    /// <summary>For an upgrade: the tag to move to (null keeps the record's). On the job, not the record, so a queued fleet upgrade that never runs changes nothing.</summary>
    public string? ImageTag { get; set; }

    /// <summary>For a fleet upgrade: the tenant that went first; the rest run only while it stands Running on the tag.</summary>
    public Guid? CanaryId { get; set; }

    public JobLane Lane { get; set; }

    /// <summary>Lower runs first within a lane: 0 for what an admin or a sweep needs now (stop, suspend, destroy), 10 for a stamp, 20 for a backup.</summary>
    public int Priority { get; set; }

    public JobStatus Status { get; set; } = JobStatus.Queued;

    /// <summary>How many times a worker picked it up; a job interrupted twice is not tried a third time.</summary>
    public int Attempts { get; set; }

    public DateTimeOffset EnqueuedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Not before this moment, when set: a job put back to wait.</summary>
    public DateTimeOffset? NotBefore { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? FinishedAt { get; set; }

    /// <summary>Why it failed, or why it was put aside.</summary>
    public string? Error { get; set; }

    /// <summary>The platform admin's subject, or "system" for the sweeps and the nightly run.</summary>
    public string RequestedBy { get; set; } = "system";
}
