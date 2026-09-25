using System.Net;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>What the platform page answers: the box, the plans, the queue, the fleet, the mail, and who may ask.</summary>
[TestClass]
public sealed class PlatformScenarios
{
    [TestMethod]
    public async Task The_platform_page_counts_its_tenants_and_the_room_left_on_the_box()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("platform");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var platform = await api.PlatformAsync();
        Assert.AreEqual("ninja.test", platform.Domain);
        Assert.IsTrue(platform.DryRun, "the tests run a dry-run box");
        Assert.IsTrue(platform.Running >= 1);
        Assert.IsTrue(platform.Total >= platform.Running);

        var capacity = await api.CapacityAsync();
        Assert.IsTrue(capacity.MemTotalMb > 0);
        Assert.IsTrue(capacity.Tenants.Any(t => t.Slug == slug), "a running stack takes its share of the box");

        var summaries = await api.ListAsync();
        var summary = summaries.Single(t => t.Slug == slug);
        Assert.AreEqual(TenantStatus.Running, summary.Status);
        Assert.AreEqual(TenantPlan.Starter, summary.Plan);
    }

    [TestMethod]
    public async Task The_plans_say_what_each_includes_and_what_can_be_bought_on_top()
    {
        var plans = await Api.AsPlatformAdmin().PlansAsync();

        CollectionAssert.AreEquivalent(Enum.GetValues<Module>(), plans.Modules);
        var free = plans.Plans.Single(p => p.Plan == TenantPlan.Free);
        CollectionAssert.AreEqual(new[] { Module.Kds }, free.Included);
        CollectionAssert.AreEquivalent(new[] { Module.Reservations, Module.TimeBilling, Module.Loyalty, Module.Tabs, Module.Inventory, Module.Finance, Module.Payroll, Module.PayAtTable }, free.Addons);
        var pro = plans.Plans.Single(p => p.Plan == TenantPlan.Pro);
        CollectionAssert.AreEquivalent(Enum.GetValues<Module>().Where(m => m != Module.PayAtTable).ToArray(), pro.Included);
        CollectionAssert.AreEqual(new[] { Module.PayAtTable }, pro.Addons, "pay at table is bought on its own, whatever the plan");
        Assert.IsTrue(plans.Plans.All(p => !p.Included.Contains(Module.PayAtTable) && p.Addons.Contains(Module.PayAtTable)), "an add-on on every plan, included in none");
    }

    [TestMethod]
    public async Task The_queue_shows_what_ran_and_a_running_job_cannot_be_cancelled()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("queue");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var queue = await api.JobsAsync();
        CollectionAssert.AreEquivalent(Enum.GetValues<JobLane>(), queue.Lanes.Select(l => l.Lane).ToArray(), "a lane is shown even when it is idle");
        var provision = queue.Recent.First(j => j.Slug == slug && j.Action == "provision");
        Assert.AreEqual(JobStatus.Done, provision.Status);
        Assert.IsNotNull(provision.FinishedAt);
        Assert.AreEqual(TestAuth.UserId, provision.RequestedBy, "the admin who asked is on the job");

        var (status, detail) = await api.RefusedAsync(HttpMethod.Delete, $"/api/control/platform/jobs/{provision.Id}");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("only a queued job can be cancelled", detail);

        (status, _) = await api.RefusedAsync(HttpMethod.Delete, "/api/control/platform/jobs/99999999");
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task A_fleet_upgrade_queues_the_canary_first_and_refuses_a_tenant_that_is_not_running()
    {
        var api = Api.AsPlatformAdmin();
        var canary = Api.Slug("canary");
        var follower = Api.Slug("follower");
        var stopped = Api.Slug("asleep");
        foreach (var slug in new[] { canary, follower, stopped })
        {
            await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
            await api.SettledAsync(slug);
        }
        await api.StopAsync(stopped);
        await api.SettledAsync(stopped);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, "/api/control/platform/upgrade", new { imageTag = "v3", slugs = new[] { canary, stopped } });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains(stopped, detail, "only a running stack can be upgraded");

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, "/api/control/platform/upgrade", new { imageTag = "v3", canary = stopped, slugs = new[] { canary, follower } });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("not a running tenant in the selection", detail);

        var queued = await api.FleetUpgradeAsync("v3", canary, canary, follower);
        Assert.AreEqual(2, queued.Queued);
        Assert.AreEqual(canary, queued.Canary);
        foreach (var slug in new[] { canary, follower })
        {
            var tenant = await api.SettledAsync(slug);
            Assert.AreEqual("v3", tenant.ImageTag, $"{slug} is on the new tag");
        }
        Assert.IsTrue((await api.AuditAsync(canary)).Any(a => a.Action == "tenant.upgrade.done"));
    }

    [TestMethod]
    public async Task The_updates_view_knows_the_tags_the_tenants_stand_on()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("updates");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var updates = await api.UpdatesAsync();
        Assert.Contains("v1", updates.KnownTags.ToList(), "the tag a tenant stands on is offered");
    }

    [TestMethod]
    public async Task Mail_that_is_not_configured_says_so_and_refuses_to_pretend()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("mail");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var mail = await api.MailAsync();
        Assert.IsFalse(mail.Configured, "the tests run without SMTP");

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/mail/welcome");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("Mail is not configured", detail);

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, "/api/control/platform/mail/realms");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("Mail is not configured", detail);
    }

    [TestMethod]
    public async Task The_edge_is_told_which_hosts_it_may_get_a_certificate_for()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("tls");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        // Anonymous on purpose: Caddy asks before anyone has signed in
        using var edge = api.Anonymous();
        Assert.AreEqual(HttpStatusCode.OK, (await edge.GetAsync($"/api/control/tls/ask?domain={slug}.ninja.test")).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await edge.GetAsync($"/api/control/tls/ask?domain=admin.{slug}.ninja.test")).StatusCode);
        Assert.AreEqual(HttpStatusCode.NotFound, (await edge.GetAsync("/api/control/tls/ask?domain=someone-elses.example.com")).StatusCode);
    }

    [TestMethod]
    public async Task Every_platform_endpoint_is_behind_the_door()
    {
        using var nobody = Api.AsPlatformAdmin().Anonymous();
        foreach (var path in new[] { "/api/control/platform", "/api/control/platform/capacity", "/api/control/platform/plans", "/api/control/platform/jobs", "/api/control/platform/updates", "/api/control/platform/mail", "/api/control/platform/backups", "/api/control/audit", "/api/control/tenants" })
        {
            using var response = await nobody.GetAsync(path);
            Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode, path);
        }
    }
}
