using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// The queue on the record: what goes in once, what comes out first, what a
/// backup waits for, what a cancel can reach, and what a restart puts right.
/// Over the in-memory provider through the same scopes the workers use.
/// </summary>
[TestClass]
public sealed class JobQueueTests
{
    private ServiceProvider _services = null!;
    private ProvisioningQueue _queue = null!;
    private CollectingAudit _audit = null!;
    private Tenant _blue = null!;
    private Tenant _red = null!;

    private sealed class CollectingAudit : IAuditWriter
    {
        public List<(string Action, string? Slug)> Entries { get; } = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) { Entries.Add((action, slug)); return Task.CompletedTask; }
    }

    [TestInitialize]
    public async Task Setup()
    {
        _audit = new CollectingAudit();
        var name = Guid.NewGuid().ToString();
        _services = new ServiceCollection()
            .AddLogging()
            .AddHttpContextAccessor()
            .AddDbContext<ControlContext>(o => o.UseInMemoryDatabase(name))
            .AddSingleton<IAuditWriter>(_audit)
            .AddSingleton<ProvisioningQueue>()
            .BuildServiceProvider();
        _queue = _services.GetRequiredService<ProvisioningQueue>();

        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        _blue = new Tenant { Slug = "blue", NameEn = "Blue", Status = TenantStatus.Running, OwnerEmail = "o@blue.test" };
        _red = new Tenant { Slug = "red", NameEn = "Red", Status = TenantStatus.Upgrading, OwnerEmail = "o@red.test" };
        context.Tenants.AddRange(_blue, _red);
        await context.SaveChangesAsync();
    }

    [TestCleanup]
    public void Cleanup() => _services.Dispose();

    private ControlContext Context() => _services.CreateScope().ServiceProvider.GetRequiredService<ControlContext>();

    [TestMethod]
    public async Task The_same_job_queued_twice_is_one_row_and_a_stop_goes_before_a_stamp()
    {
        var first = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "provision"), CancellationToken.None);
        var again = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "provision"), CancellationToken.None);
        var upgradeV2 = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "upgrade", "v2"), CancellationToken.None);
        var upgradeV3 = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "upgrade", "v3"), CancellationToken.None);
        var stop = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "stop"), CancellationToken.None);

        Assert.AreEqual(first, again, "a second click adds nothing");
        Assert.AreNotEqual(upgradeV2, upgradeV3, "an upgrade to another tag is another job");
        Assert.AreEqual(4, Context().Jobs.Count());

        var claimed = await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None);
        Assert.AreEqual(stop, claimed!.Id, "what an admin needs now runs before the stamp that was waiting");
        Assert.AreEqual(JobStatus.Running, claimed.Status);
        Assert.AreEqual(1, claimed.Attempts);
        Assert.IsNotNull(claimed.StartedAt);
        Assert.AreEqual("system", claimed.RequestedBy);

        await _queue.CompleteAsync(stop, null, CancellationToken.None);
        Assert.AreEqual(JobStatus.Done, Context().Jobs.Single(j => j.Id == stop).Status);

        var next = await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None);
        Assert.AreEqual(first, next!.Id, "then in the order they came");
        await _queue.CompleteAsync(first, "boom", CancellationToken.None);
        var failed = Context().Jobs.Single(j => j.Id == first);
        Assert.AreEqual(JobStatus.Failed, failed.Status);
        Assert.AreEqual("boom", failed.Error);
    }

    [TestMethod]
    public async Task A_backup_waits_while_its_tenant_is_mid_stamp_and_never_holds_the_stamp_lane()
    {
        var redBackup = await _queue.EnqueueAsync(new ProvisioningJob(_red.Id, "backup"), CancellationToken.None);
        var blueBackup = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "backup"), CancellationToken.None);

        Assert.IsNull(await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None), "backups are not the stamp lane's");
        var claimed = await _queue.ClaimAsync(JobLane.Backup, CancellationToken.None);
        Assert.AreEqual(blueBackup, claimed!.Id, "red is upgrading: a dump mid-migration is no backup, so it waits");

        await _queue.CompleteAsync(blueBackup, null, CancellationToken.None);
        Assert.IsNull(await _queue.ClaimAsync(JobLane.Backup, CancellationToken.None));

        using (var context = Context())
        {
            context.Tenants.Single(t => t.Id == _red.Id).Status = TenantStatus.Running;
            await context.SaveChangesAsync();
        }
        Assert.AreEqual(redBackup, (await _queue.ClaimAsync(JobLane.Backup, CancellationToken.None))!.Id);
    }

    [TestMethod]
    public async Task Only_a_queued_job_can_be_cancelled()
    {
        var upgrade = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "upgrade", "v2"), CancellationToken.None);
        var running = await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None);
        var later = await _queue.EnqueueAsync(new ProvisioningJob(_blue.Id, "stop"), CancellationToken.None);

        Assert.IsFalse(await _queue.CancelAsync(running!.Id, CancellationToken.None));
        Assert.IsTrue(await _queue.CancelAsync(later, CancellationToken.None));
        Assert.AreEqual(JobStatus.Cancelled, Context().Jobs.Single(j => j.Id == later).Status);
        Assert.IsNull(await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None), "a cancelled job never runs");
        Assert.AreEqual(upgrade, running.Id);
    }

    [TestMethod]
    public async Task A_restart_queues_an_interrupted_job_once_and_marks_a_tenant_left_mid_way_as_failed()
    {
        long once, twice;
        using (var context = Context())
        {
            var stuck = new Tenant { Slug = "green", NameEn = "Green", Status = TenantStatus.Provisioning, OwnerEmail = "o@green.test" };
            var black = new Tenant { Slug = "black", NameEn = "Black", Status = TenantStatus.Provisioning, OwnerEmail = "o@black.test" };
            context.Tenants.AddRange(stuck, black);
            // red was mid-upgrade with a worker on it when the process died; blue's job had already died once before
            var first = new Job { TenantId = _red.Id, Action = "upgrade", ImageTag = "v2", Lane = JobLane.Stamp, Priority = 10, Status = JobStatus.Running, Attempts = 1, StartedAt = DateTimeOffset.UtcNow };
            var second = new Job { TenantId = _blue.Id, Action = "backup", Lane = JobLane.Backup, Priority = 20, Status = JobStatus.Running, Attempts = 2, StartedAt = DateTimeOffset.UtcNow };
            // black still has its provision waiting, so it is not stuck
            var waiting = new Job { TenantId = black.Id, Action = "provision", Lane = JobLane.Stamp, Priority = 10, Status = JobStatus.Queued };
            context.Jobs.AddRange(first, second, waiting);
            await context.SaveChangesAsync();
            (once, twice) = (first.Id, second.Id);
        }

        var (requeued, abandoned, failed) = await _queue.RecoverAsync(CancellationToken.None);

        Assert.AreEqual((1, 1, 1), (requeued, abandoned, failed));
        using var after = Context();
        var again = after.Jobs.Single(j => j.Id == once);
        Assert.AreEqual(JobStatus.Queued, again.Status);
        Assert.IsNull(again.StartedAt);
        StringAssert.Contains(again.Error, "restart");
        Assert.AreEqual(JobStatus.Failed, after.Jobs.Single(j => j.Id == twice).Status);

        var green = after.Tenants.Single(t => t.Slug == "green");
        Assert.AreEqual(TenantStatus.Failed, green.Status, "nothing queued for it: it would stay Provisioning for ever");
        StringAssert.Contains(green.LastError, "Provisioning");
        Assert.AreEqual(TenantStatus.Provisioning, after.Tenants.Single(t => t.Slug == "black").Status, "its provision is still on the line");
        Assert.AreEqual(TenantStatus.Upgrading, after.Tenants.Single(t => t.Slug == "red").Status, "its upgrade runs again");
        Assert.IsTrue(_audit.Entries.Contains(("tenant.interrupted", "green")));

        // The requeued upgrade is the next thing the stamp lane runs, and it counts as its second attempt
        var claimed = await _queue.ClaimAsync(JobLane.Stamp, CancellationToken.None);
        Assert.AreEqual(once, claimed!.Id);
        Assert.AreEqual(2, claimed.Attempts);
    }
}
