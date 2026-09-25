using System.Net;
using Ninja.Control.API.Model;

namespace Ninja.Control.FunctionalTests;

/// <summary>A tenant's life on the platform, through the API: stamped, stopped and started, upgraded, destroyed, forgotten.</summary>
[TestClass]
public sealed class LifecycleScenarios
{
    private static string[] Steps(Ninja.Control.API.Apis.TenantDetail tenant) => tenant.Steps.Select(s => $"{s.Name}:{s.Status}").ToArray();

    [TestMethod]
    public async Task A_customer_is_stamped_in_its_plans_shape_with_a_realm_and_an_owner()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("stamp");

        var created = await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        Assert.AreEqual(TenantStatus.Requested, created.Status, "the record is there before the stamp");

        var tenant = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, tenant.Status, tenant.LastError);
        Assert.IsNotNull(tenant.ProvisionedAt);
        Assert.IsTrue(tenant.HasOwnCredentials, "a fresh stack has its own database role and broker user");
        Assert.IsNotNull(tenant.OwnerInitialPassword, "the owner's first password is kept for the welcome");
        CollectionAssert.AreEqual(
            new[] { "credentials", "databases", "broker", "realm", "stack", "edge", "health", "brand", "entitlements", "owner", "broker-lockdown" },
            tenant.Steps.Select(s => s.Name).ToArray());
        Assert.IsTrue(tenant.Steps.All(s => s.Status == StepStatus.Done));
        CollectionAssert.AreEqual(new[] { "catalog", "ordering", "spaces", "sales", "identity", "loyalty", "notification", "accounts", "tenant", "assistant" }, tenant.Services.ToArray());
        Assert.Contains($"{slug}.ninja.test", tenant.Hosts.Customer, "the customer host is the slug under the platform's domain");

        var shell = ControlPlane.Factory.Shell.Commands;
        Assert.IsTrue(shell.Any(c => c.Contains($"compose -p ninja-{slug} up -d")), "the stack came up");
    }

    [TestMethod]
    public async Task A_stop_and_a_start_keep_the_shape_and_the_start_tells_the_stack_its_entitlements()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("cycle");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        await api.StopAsync(slug);
        Assert.AreEqual(TenantStatus.Stopped, (await api.SettledAsync(slug)).Status);
        var (status, _) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/stop");
        Assert.AreEqual(HttpStatusCode.Conflict, status, "stopped twice is a refusal, not a job");

        await api.StartAsync(slug);
        var started = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, started.Status, started.LastError);
        CollectionAssert.AreEqual(new[] { "start:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps(started));
        Assert.DoesNotContain($"{slug}-inventory-api:", Api.ComposeOnDisk(slug));
    }

    [TestMethod]
    public async Task An_upgrade_backs_up_first_moves_the_tag_and_keeps_the_plans_shape()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("upgrade");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        var before = await api.SettledAsync(slug);
        Assert.AreEqual("v1", before.ImageTag);

        await api.UpgradeAsync(slug, "v2");
        var after = await api.SettledAsync(slug);

        Assert.AreEqual(TenantStatus.Running, after.Status, after.LastError);
        Assert.AreEqual("v2", after.ImageTag);
        Assert.AreEqual("v1", after.PreviousImageTag, "the tag before, for a rollback");
        Assert.IsNotNull(after.UpgradeBackupId, "a backup before anything changed");
        CollectionAssert.AreEqual(new[] { "credentials:Done", "databases:Done", "broker:Done", "backup:Done", "stack:Done", "health:Done", "broker-lockdown:Done", "retired:Done" }, Steps(after));
        var yaml = Api.ComposeOnDisk(slug);
        Assert.Contains(":v2\"", yaml);
        Assert.DoesNotContain($"{slug}-inventory-api:", yaml, "an upgrade rewrites the compose from the plan");
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "tenant.upgrade.done"));
    }

    [TestMethod]
    public async Task A_bad_image_tag_is_refused_before_anything_is_queued()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("badtag");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/upgrade", new { imageTag = "v2; rm -rf /" });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("image tag", detail);
        Assert.IsEmpty((await api.TenantAsync(slug)).Jobs);
    }

    [TestMethod]
    public async Task Destroy_takes_the_stack_down_and_only_then_can_the_record_be_forgotten()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("destroy");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        Assert.IsTrue(Api.HasStack(slug));

        var (status, detail) = await api.RefusedAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}/record");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("Destroy it first", detail);

        await api.DestroyAsync(slug);
        var destroyed = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Destroyed, destroyed.Status, destroyed.LastError);
        Assert.IsFalse(Api.HasStack(slug), "the stack folder goes with the containers");
        Assert.IsTrue(ControlPlane.Factory.Shell.Commands.Any(c => c.Contains($"compose -p ninja-{slug} down -v --remove-orphans")));
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "tenant.destroy.done"));

        (status, _) = await api.RefusedAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}/record");
        Assert.AreEqual(HttpStatusCode.NoContent, status);
        (status, _) = await api.RefusedAsync(HttpMethod.Get, $"/api/control/tenants/{slug}");
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }
}
