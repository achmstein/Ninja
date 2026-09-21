using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>The work queue: what each lane is on, what waits behind it, what ran lately; a queued job can be taken off the line.</summary>
public static partial class ControlApi
{
    private static void MapJobsApi(RouteGroupBuilder api)
    {
        api.MapGet("/platform/jobs", GetJobs).WithName("GetPlatformJobs").WithSummary("Each lane's running job and queue depth, and the latest jobs").RequireAuthorization("Platform");
        api.MapDelete("/platform/jobs/{id:long}", CancelJob).WithName("CancelPlatformJob").WithSummary("Take a queued job off the line; a running one cannot be stopped").RequireAuthorization("Platform");
    }

    public static async Task<Ok<QueueResponse>> GetJobs(
        ControlContext context, ProvisioningQueue queue,
        [Description("How many of the latest jobs, 200 at most")] int take = 50,
        CancellationToken ct = default)
    {
        var slugs = await context.Tenants.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Slug, ct);
        var open = await context.Jobs.AsNoTracking()
            .Where(j => j.Status == JobStatus.Queued || j.Status == JobStatus.Running)
            .OrderBy(j => j.Priority).ThenBy(j => j.Id)
            .ToListAsync(ct);
        var recent = await context.Jobs.AsNoTracking()
            .Where(j => j.Status != JobStatus.Queued && j.Status != JobStatus.Running)
            .OrderByDescending(j => j.Id).Take(Math.Clamp(take, 1, 200))
            .ToListAsync(ct);

        var lanes = Enum.GetValues<JobLane>().Select(lane =>
        {
            var queued = open.Where(j => j.Lane == lane && j.Status == JobStatus.Queued).ToList();
            return new LaneStatus(
                lane,
                open.Where(j => j.Lane == lane && j.Status == JobStatus.Running).Select(j => JobDto.From(j, slugs, null)).FirstOrDefault(),
                queued.Select((j, i) => JobDto.From(j, slugs, i + 1)).ToList());
        }).ToList();

        return TypedResults.Ok(new QueueResponse(lanes, recent.Select(j => JobDto.From(j, slugs, null)).ToList()));
    }

    public static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> CancelJob(ControlContext context, ProvisioningQueue queue, IAuditWriter audit, long id, CancellationToken ct)
    {
        var job = await context.Jobs.AsNoTracking().SingleOrDefaultAsync(j => j.Id == id, ct);
        if (job is null) return TypedResults.NotFound();
        if (job.Status != JobStatus.Queued)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Job {id} is {job.Status}; only a queued job can be cancelled." });
        if (!await queue.CancelAsync(id, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Job {id} started before it could be cancelled." });
        var slug = await context.Tenants.AsNoTracking().Where(t => t.Id == job.TenantId).Select(t => t.Slug).SingleOrDefaultAsync(ct);
        await audit.WriteAsync("job.cancelled", slug, new { id, job.Action, job.ImageTag }, ct);
        return TypedResults.NoContent();
    }

    /// <summary>One tenant's open jobs, each with its place in its lane's line.</summary>
    internal static async Task<IReadOnlyList<JobDto>> OpenJobsAsync(ControlContext context, Tenant tenant, CancellationToken ct)
    {
        var mine = await context.Jobs.AsNoTracking()
            .Where(j => j.TenantId == tenant.Id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running))
            .OrderBy(j => j.Priority).ThenBy(j => j.Id)
            .ToListAsync(ct);
        if (mine.Count == 0) return [];
        var slugs = new Dictionary<Guid, string> { [tenant.Id] = tenant.Slug };
        var result = new List<JobDto>();
        foreach (var job in mine)
        {
            int? position = null;
            if (job.Status == JobStatus.Queued)
                position = 1 + await context.Jobs.CountAsync(j => j.Status == JobStatus.Queued && j.Lane == job.Lane && (j.Priority < job.Priority || (j.Priority == job.Priority && j.Id < job.Id)), ct);
            result.Add(JobDto.From(job, slugs, position));
        }
        return result;
    }
}

/// <param name="Position">Its place in its lane's line, from 1; null once it runs.</param>
public record JobDto(long Id, string? Slug, string Action, string? ImageTag, JobLane Lane, JobStatus Status, int Attempts, DateTimeOffset EnqueuedAt, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt, string? Error, string RequestedBy, int? Position)
{
    public static JobDto From(Job j, IReadOnlyDictionary<Guid, string> slugs, int? position)
        => new(j.Id, slugs.GetValueOrDefault(j.TenantId), j.Action, j.ImageTag, j.Lane, j.Status, j.Attempts, j.EnqueuedAt, j.StartedAt, j.FinishedAt, j.Error, j.RequestedBy, position);
}

/// <param name="Running">What the lane's worker is on now, or null while it waits.</param>
/// <param name="Queued">What waits behind it, in the order it will run.</param>
public record LaneStatus(JobLane Lane, JobDto? Running, IReadOnlyList<JobDto> Queued);

/// <param name="Recent">Jobs that finished, newest first.</param>
public record QueueResponse(IReadOnlyList<LaneStatus> Lanes, IReadOnlyList<JobDto> Recent);
