using Ninja.Control.API.Model;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.API.Platform;

/// <summary>
/// A tenant moved to another node: the same slug, realm, passwords and data,
/// minutes of downtime, and nothing for its customers to do. Every step is
/// recorded and may run again after a restart; until the switch, a failure
/// puts everything back on the old node. The old copy is kept stopped for
/// <see cref="PlatformOptions.MoveQuarantineDays"/>, then cleared.
/// </summary>
public sealed partial class Provisioner
{
    /// <summary>The longest a stack's queues are given to empty once its gateway is closed.</summary>
    internal static TimeSpan QueueDrain { get; set; } = TimeSpan.FromMinutes(2);

    /// <summary>
    /// The queues that are not a stack's work to finish: the dead letters, which wait for a person. They stay
    /// on the old node with its quarantined copy.
    /// </summary>
    internal static bool Drains(string queue) => !queue.Contains("dead_letter", StringComparison.OrdinalIgnoreCase);

    public async Task MoveAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        // Finished before a restart, or undone: nothing is pending
        if (tenant.MovingToNodeId is not int targetId) return;

        var runId = Guid.NewGuid();
        var sourceId = tenant.NodeId;
        var source = nodes.For(sourceId);
        var target = nodes.For(targetId);
        // What it goes back to, on either node: kept on the record, so a move picked up after a restart knows
        var was = tenant.StatusBeforeMove ??= tenant.Status;
        tenant.Status = TenantStatus.Moving;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.move.started", tenant.Slug, new { runId, from = source.Node.Name, to = target.Node.Name }, ct, Source);

        try
        {
            await MovePrepareStepAsync(tenant, runId, target, ct);
            await MoveQuiesceStepAsync(tenant, runId, source, was, ct);
            var backup = await Step(tenant, runId, "move-backup", async () =>
            {
                // Taken with the stack stopped: every write it took is in it. Also the safety copy, kept with the others
                var created = await backups.CreateAsync(tenant, ct);
                return created.Id;
            }, ct);
            await Step(tenant, runId, "move-restore", async () =>
            {
                await backups.RestoreDatabasesAsync(tenant.Slug, backup, tenant, ct, on: target);
                var uploads = await backups.RestoreUploadsAsync(tenant.Slug, backup, tenant, ct, on: target);
                return $"{TenantNaming.Databases.Length} databases{(uploads ? " and its uploads" : "")} from {backup} onto {target.Node.Name}";
            }, ct);
            await Step(tenant, runId, "move-start", async () =>
            {
                if (was != TenantStatus.Running) return "it was stopped: it stays stopped there";
                var output = await target.Stacks.UpAsync(tenant.Slug, Platform.PullImages, ct);
                // Asked on the new node directly: the edge still sends its customers to the old one, which is closed
                await stack.WaitHealthyAsync(tenant.On(targetId), TimeSpan.FromMinutes(5), ct);
                return output;
            }, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Moving {Slug} to {Node} failed; undoing", tenant.Slug, target.Node.Name);
            await UndoMoveAsync(tenant, runId, source, target, was, ex, ct);
            return;
        }

        // The switch: from here the tenant is the new node's, whatever else goes wrong
        await Step(tenant, runId, "move-switch", async () =>
        {
            tenant.NodeId = targetId;
            tenant.MovingToNodeId = null;
            tenant.Status = was;
            tenant.StatusBeforeMove = null;
            await context.SaveChangesAsync(ct);
            return $"{source.Node.Name} → {target.Node.Name}";
        }, ct);

        try
        {
            await Step(tenant, runId, "edge", () => edge.ApplyAsync(ct), ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            // Its customers still reach the closed old node until the edge is rewritten: say so, and queue it again
            logger.LogError(ex, "{Slug} moved but the edge was not rewritten", tenant.Slug);
            tenant.LastError = $"Moved to {target.Node.Name}, but the edge still sends it to {source.Node.Name}: {ex.Message}";
            await context.SaveChangesAsync(ct);
            if (queue is not null) await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "edge"), ct);
        }

        // The old copy, stopped and kept a while, then cleared by a job of its own on that node
        try
        {
            await source.Stacks.WriteMarkerAsync(tenant.Slug, "moved-to", $"{DateTimeOffset.UtcNow:O} {target.Node.Name}", ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "{Slug}: the old copy on {Node} has no moved-to marker", tenant.Slug, source.Node.Name);
        }
        if (queue is not null)
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "move-cleanup", NodeId: sourceId, NotBefore: DateTimeOffset.UtcNow.AddDays(Platform.MoveQuarantineDays)), ct);
        await audit.WriteAsync("tenant.move.done", tenant.Slug, new { runId, from = source.Node.Name, to = target.Node.Name }, ct, Source);
    }

    /// <summary>The target given what the tenant needs there: the same role and broker user, empty databases, its vhost, its stack's files.</summary>
    private Task<string> MovePrepareStepAsync(Tenant tenant, Guid runId, INodeClient target, CancellationToken ct)
        => Step(tenant, runId, "move-prepare", async () =>
        {
            if (tenant.DbPassword is null || tenant.BrokerPassword is null)
                throw new InvalidOperationException("It has no credentials of its own yet; secure it first.");
            await target.Databases.EnsureRoleAsync(TenantNaming.DbRole(tenant.Slug), tenant.DbPassword, ct);
            foreach (var db in TenantNaming.Databases)
                await target.Databases.EnsureDatabaseAsync(TenantNaming.Database(tenant.Slug, db), TenantNaming.DbRole(tenant.Slug), ct);
            await target.Broker.EnsureUserAsync(TenantNaming.BrokerUser(tenant.Slug), tenant.BrokerPassword, ct);
            await target.Broker.EnsureVHostAsync(TenantNaming.VHost(tenant.Slug), TenantNaming.BrokerUser(tenant.Slug), ct);
            await WriteStackFilesAsync(tenant, ct, on: target);
            return $"{target.Node.Name}: its role, {TenantNaming.Databases.Length} databases, broker user and vhost, stack files";
        }, ct);

    /// <summary>
    /// The old node closed to new requests, its queues let empty, then stopped: what the backup takes is all
    /// there is. A queue that will not empty stops the move, which is undone, rather than lose its messages.
    /// </summary>
    private Task<string> MoveQuiesceStepAsync(Tenant tenant, Guid runId, INodeClient source, TenantStatus was, CancellationToken ct)
        => Step(tenant, runId, "move-quiesce", async () =>
        {
            if (was != TenantStatus.Running)
            {
                await source.Stacks.StopAsync(tenant.Slug, ct);
                return "it was not running";
            }
            await source.Stacks.StopServiceAsync(tenant.Slug, "gateway", ct);
            var vhost = TenantNaming.VHost(tenant.Slug);
            var deadline = DateTimeOffset.UtcNow + QueueDrain;
            long waiting;
            while (true)
            {
                var depths = await source.Broker.QueueDepthsAsync(vhost, ct);
                waiting = depths.Where(q => Drains(q.Key)).Sum(q => q.Value);
                if (waiting == 0 || DateTimeOffset.UtcNow >= deadline) break;
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
            if (waiting > 0)
                throw new InvalidOperationException($"{waiting} message(s) were still queued after {QueueDrain.TotalMinutes:0} minutes; the move is undone so none is lost. Look at the stack's queues, then move it again.");
            await source.Stacks.StopAsync(tenant.Slug, ct);
            return "its gateway closed, its queues empty, its stack stopped";
        }, ct);

    /// <summary>Before the switch, a failed move leaves no trace on the target and the tenant as it was on the old node.</summary>
    private async Task UndoMoveAsync(Tenant tenant, Guid runId, INodeClient source, INodeClient target, TenantStatus was, Exception cause, CancellationToken ct)
    {
        var said = new List<string>();
        try
        {
            await Step(tenant, runId, "move-undo", async () =>
            {
                if (await target.Stacks.IsStampedAsync(tenant.Slug, ct))
                {
                    await target.Stacks.DownAsync(tenant.Slug, ct);
                    said.Add($"its stack taken off {target.Node.Name}");
                }
                await ClearCopyAsync(tenant, target, ct);
                said.Add("its databases, role, vhost and broker user dropped there");
                if (was == TenantStatus.Running)
                {
                    await source.Stacks.UpAsync(tenant.Slug, pull: false, ct);
                    said.Add($"running again on {source.Node.Name}");
                }
                return string.Join("; ", said);
            }, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Undoing the move of {Slug} failed too", tenant.Slug);
            said.Add($"the undo stopped: {ex.Message}");
        }

        tenant.Status = was;
        tenant.MovingToNodeId = null;
        tenant.StatusBeforeMove = null;
        tenant.LastError = $"Moving to {target.Node.Name} failed and was undone: {cause.Message}";
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.move.failed", tenant.Slug, new { runId, to = target.Node.Name, error = cause.Message, undone = said }, ct, Source);
    }

    /// <summary>
    /// A tenant whose node does not answer, brought up on another from its newest backup: the same slug, realm
    /// and passwords, what it took since that backup lost. Nothing is asked of the node it was on; when that one
    /// answers again, the watchdog stops the copy left there before it can do anything (fencing).
    /// </summary>
    public async Task EvacuateAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        if (tenant.MovingToNodeId is not int targetId) return;

        var runId = Guid.NewGuid();
        var lost = nodes.For(tenant.NodeId);
        var target = nodes.For(targetId);
        var was = tenant.StatusBeforeMove ??= tenant.Status is TenantStatus.Moving ? TenantStatus.Running : tenant.Status;
        tenant.Status = TenantStatus.Moving;
        tenant.LastError = null;
        await context.SaveChangesAsync(ct);

        var newest = backups.List(tenant.Slug).FirstOrDefault();
        try
        {
            if (newest is null)
                throw new InvalidOperationException("It has no backup to bring it back from.");
            await MovePrepareStepAsync(tenant, runId, target, ct);
            await Step(tenant, runId, "evacuate-restore", async () =>
            {
                await backups.VerifyAsync(tenant.Slug, newest, ct);
                await backups.RestoreDatabasesAsync(tenant.Slug, newest.Id, tenant, ct, on: target);
                var uploads = await backups.RestoreUploadsAsync(tenant.Slug, newest.Id, tenant, ct, on: target);
                return $"from {newest.Id}, taken {newest.At:u}{(uploads ? ", with its uploads" : "")}: what came after it is lost";
            }, ct);
            await Step(tenant, runId, "move-start", async () =>
            {
                if (was != TenantStatus.Running) return "it was stopped: it stays stopped there";
                var output = await target.Stacks.UpAsync(tenant.Slug, Platform.PullImages, ct);
                await stack.WaitHealthyAsync(tenant.On(targetId), TimeSpan.FromMinutes(5), ct);
                return output;
            }, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Evacuating {Slug} to {Node} failed", tenant.Slug, target.Node.Name);
            try
            {
                if (await target.Stacks.IsStampedAsync(tenant.Slug, ct)) await target.Stacks.DownAsync(tenant.Slug, ct);
                await ClearCopyAsync(tenant, target, ct);
            }
            catch (Exception inner) when (!ct.IsCancellationRequested)
            {
                logger.LogError(inner, "Clearing {Slug}'s copy on {Node} failed too", tenant.Slug, target.Node.Name);
            }
            tenant.Status = was;
            tenant.MovingToNodeId = null;
            tenant.StatusBeforeMove = null;
            tenant.LastError = $"Bringing it up on {target.Node.Name} failed: {ex.Message}";
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("tenant.evacuate.failed", tenant.Slug, new { runId, to = target.Node.Name, error = ex.Message }, ct, Source);
            return;
        }

        await Step(tenant, runId, "move-switch", async () =>
        {
            tenant.NodeId = targetId;
            tenant.MovingToNodeId = null;
            tenant.Status = was;
            tenant.StatusBeforeMove = null;
            // Said on the record, not only in the steps: its owner may ask why yesterday's orders are gone
            tenant.LastError = $"Brought up on {target.Node.Name} from its backup of {newest.At:u}, {lost.Node.Name} not answering; what it took after that is lost.";
            await context.SaveChangesAsync(ct);
            return $"{lost.Node.Name} → {target.Node.Name}, from {newest.Id}";
        }, ct);
        try
        {
            await Step(tenant, runId, "edge", () => edge.ApplyAsync(ct), ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "{Slug} evacuated but the edge was not rewritten", tenant.Slug);
            if (queue is not null) await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "edge"), ct);
        }
        await audit.WriteAsync("tenant.evacuated", tenant.Slug, new { runId, from = lost.Node.Name, to = target.Node.Name, backup = newest.Id, newest.At }, ct, Source);
    }

    /// <summary>
    /// A node answering again after its tenants were brought up elsewhere: every stack still running there whose
    /// tenant lives on another node now is stopped (its restart policy brought it back with the box), and its
    /// clearing queued for after the quarantine. Returns the stacks stopped.
    /// </summary>
    public async Task<IReadOnlyList<string>> FenceAsync(int nodeId, CancellationToken ct)
    {
        var node = nodes.For(nodeId);
        var reading = await node.Capacity.ProbeAsync(ct);
        var running = reading.Projects
            .Where(p => CapacityMath.IsStack(p.Project, reading.PlatformProject) && p.Running > 0)
            .Select(p => p.Project["ninja-".Length..])
            .ToHashSet(StringComparer.Ordinal);
        var elsewhere = await context.Tenants
            .Where(t => running.Contains(t.Slug) && t.NodeId != nodeId && t.MovingToNodeId != nodeId && t.Status != TenantStatus.Destroyed)
            .ToListAsync(ct);
        var stopped = new List<string>();
        foreach (var tenant in elsewhere)
        {
            await node.Stacks.StopAsync(tenant.Slug, ct);
            stopped.Add(tenant.Slug);
            if (queue is not null)
                await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "move-cleanup", NodeId: nodeId, NotBefore: DateTimeOffset.UtcNow.AddDays(Platform.MoveQuarantineDays)), ct);
            await audit.WriteAsync("tenant.fenced", tenant.Slug, new { node = node.Node.Name }, ct, Source);
        }
        return stopped;
    }

    /// <summary>The old copy of a moved tenant, cleared once its time in quarantine is over: its stack, databases, role, vhost and user.</summary>
    public async Task MoveCleanupAsync(Guid tenantId, int nodeId, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == tenantId, ct);
        // Moved back since, or moving again: what is on that node now is the tenant itself
        if (tenant.NodeId == nodeId || tenant.MovingToNodeId == nodeId)
        {
            await audit.WriteAsync("tenant.move.cleanup-skipped", tenant.Slug, new { nodeId, reason = "it lives there again" }, ct, Source);
            return;
        }
        var node = nodes.For(nodeId);
        await Step(tenant, Guid.NewGuid(), "move-cleanup", async () =>
        {
            var said = new List<string>();
            if (await node.Stacks.IsStampedAsync(tenant.Slug, ct))
            {
                await node.Stacks.DownAsync(tenant.Slug, ct);
                said.Add("its old stack taken down");
            }
            await ClearCopyAsync(tenant, node, ct);
            said.Add("its old databases, role, vhost and broker user dropped");
            return $"{node.Node.Name}: {string.Join("; ", said)}";
        }, ct);
        await audit.WriteAsync("tenant.move.cleared", tenant.Slug, new { node = node.Node.Name }, ct, Source);
    }

    /// <summary>A tenant's data on one node gone: its databases, role, vhost and broker user. Each is gone twice without complaint.</summary>
    private static async Task ClearCopyAsync(Tenant tenant, INodeClient node, CancellationToken ct)
    {
        await node.Broker.DeleteVHostAsync(TenantNaming.VHost(tenant.Slug), ct);
        await node.Broker.DeleteUserAsync(TenantNaming.BrokerUser(tenant.Slug), ct);
        foreach (var db in TenantNaming.Databases)
            await node.Databases.DropDatabaseAsync(TenantNaming.Database(tenant.Slug, db), ct);
        await node.Databases.DropRoleAsync(TenantNaming.DbRole(tenant.Slug), ct);
    }
}
