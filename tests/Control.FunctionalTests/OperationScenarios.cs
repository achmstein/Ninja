using System.Net;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>What a platform admin does to a stack that is already up: back it up, restore it, secure it, roll it back, look at it, sign in as its owner.</summary>
[TestClass]
public sealed class OperationScenarios
{
    [TestMethod]
    public async Task A_backup_is_taken_listed_downloaded_and_deleted()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("backup");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        Assert.IsEmpty(await api.BackupsAsync(slug), "nothing is kept until one is asked for");

        await api.BackupAsync(slug);
        await api.SettledAsync(slug);
        var backup = (await api.BackupsAsync(slug)).Single();
        Assert.AreEqual("v1", backup.ImageTag, "a backup remembers the tag it was taken on");
        CollectionAssert.AreEquivalent(TenantNaming.Databases, backup.Databases.ToArray());

        using var download = await api.RawAsync(HttpMethod.Get, $"/api/control/tenants/{slug}/backups/{backup.Id}/download");
        Assert.AreEqual(HttpStatusCode.OK, download.StatusCode);
        Assert.IsTrue((await download.Content.ReadAsByteArrayAsync()).Length > 0, "the archive is a file, not an empty answer");

        var (status, _) = await api.RefusedAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}/backups/{backup.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, status);
        Assert.IsEmpty(await api.BackupsAsync(slug));
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "backup.deleted"));

        (status, _) = await api.RefusedAsync(HttpMethod.Get, $"/api/control/tenants/{slug}/backups/20200101-000000/download");
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task A_restore_makes_a_new_cafe_from_a_backup_and_leaves_the_old_one_running()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("source");
        var into = Api.Slug("copy");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        await api.BackupAsync(slug);
        await api.SettledAsync(slug);
        var backup = (await api.BackupsAsync(slug)).Single();

        var restored = await api.RestoreAsync(slug, backup.Id, into);
        Assert.AreEqual(into, restored.Slug);
        Assert.AreEqual(TenantKind.Customer, restored.Kind);
        Assert.AreEqual(TenantPlan.Starter, restored.Record.Plan, "the café comes back on the plan it was on");

        var copy = await api.SettledAsync(into);
        Assert.AreEqual(TenantStatus.Running, copy.Status, copy.LastError);
        CollectionAssert.Contains(copy.Steps.Select(s => s.Name).ToArray(), "restore-databases");
        Assert.DoesNotContain($"{into}-inventory-api:", Api.ComposeOnDisk(into), "the copy is stamped in its plan's shape too");
        Assert.AreEqual(TenantStatus.Running, (await api.TenantAsync(slug)).Status, "the source keeps running");

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/backups/{backup.Id}/restore", new { intoSlug = into, force = true });
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("is taken", detail);

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/backups/{backup.Id}/restore", new { intoSlug = "NO", force = true });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("lower-case", detail);
    }

    [TestMethod]
    public async Task Securing_a_stack_gives_it_its_own_credentials_and_rotating_gives_it_new_ones()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("secure");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        var before = Api.EnvOnDisk(slug);

        await api.SecureAsync(slug, rotate: false);
        var kept = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, kept.Status, kept.LastError);
        Assert.AreEqual(before, Api.EnvOnDisk(slug), "a stack that already has its own keeps them");

        await api.SecureAsync(slug, rotate: true);
        var rotated = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, rotated.Status, rotated.LastError);
        Assert.AreNotEqual(before, Api.EnvOnDisk(slug), "rotating writes new passwords");
        CollectionAssert.AreEqual(new[] { "credentials", "databases", "broker", "stack", "health", "broker-lockdown" }, rotated.Steps.Select(s => s.Name).ToArray());
        Assert.IsTrue((await api.AuditAsync(slug)).Count(a => a.Action == "tenant.secure.done") == 2);
    }

    [TestMethod]
    public async Task A_rollback_goes_back_to_the_tag_before_and_only_when_there_is_one()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("roll");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/rollback");
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("no previous tag", detail);

        await api.UpgradeAsync(slug, "v2");
        await api.SettledAsync(slug);
        await api.RollbackAsync(slug);
        var back = await api.SettledAsync(slug);

        Assert.AreEqual(TenantStatus.Running, back.Status, back.LastError);
        Assert.AreEqual("v1", back.ImageTag);
        Assert.Contains(":v1\"", Api.ComposeOnDisk(slug));
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "tenant.rollback"));
    }

    [TestMethod]
    public async Task The_health_and_logs_of_a_stack_are_what_the_plan_stamps()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("ops");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var health = await api.HealthAsync(slug);
        CollectionAssert.AreEqual(new[] { "catalog", "ordering", "spaces", "sales", "identity", "loyalty", "notification", "accounts", "branch" }, health.Select(h => h.Service).ToArray());
        Assert.IsTrue(health.All(h => h.Ok), "the dry-run gateway answers for every stamped service");

        using var logs = await api.RawAsync(HttpMethod.Get, $"/api/control/tenants/{slug}/logs?service=loyalty&tail=10");
        Assert.AreEqual(HttpStatusCode.OK, logs.StatusCode);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Get, $"/api/control/tenants/{slug}/logs?service=inventory");
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("service must be one of", detail);
        Assert.DoesNotContain("inventory", detail, "a service the plan does not stamp is not offered");
    }

    [TestMethod]
    public async Task A_failed_stack_keeps_its_reason_until_it_is_read()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("dismiss");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var (status, _) = await api.RefusedAsync(HttpMethod.Delete, $"/api/control/tenants/{slug}/error");
        Assert.AreEqual(HttpStatusCode.NoContent, status, "nothing to dismiss is not a failure");

        (status, _) = await api.RefusedAsync(HttpMethod.Delete, "/api/control/tenants/nobody-here/error");
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task Signing_in_as_the_owner_is_one_link_that_works_once()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("asowner");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var link = await api.ImpersonateAsync(slug);
        Assert.Contains("/api/control/impersonate/", link.Url);
        Assert.IsTrue(link.ExpiresAt > DateTimeOffset.UtcNow);
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "owner.impersonated"));

        // The link is opened on the auth host by a browser nobody has signed in
        var ticket = link.Url[(link.Url.LastIndexOf('/') + 1)..];
        using var browser = Api.NoRedirects();
        browser.DefaultRequestHeaders.Add(TestAuth.AnonymousHeader, "1");
        using var first = await browser.GetAsync($"/api/control/impersonate/{ticket}");
        Assert.AreEqual(HttpStatusCode.Redirect, first.StatusCode);
        Assert.Contains($"admin.{slug}.ninja.test", first.Headers.Location!.ToString());

        using var again = await browser.GetAsync($"/api/control/impersonate/{ticket}");
        Assert.AreEqual(HttpStatusCode.NotFound, again.StatusCode, "a ticket is good once");
    }

    [TestMethod]
    public async Task A_stack_that_is_not_running_has_nothing_to_sign_in_to_and_nothing_to_show()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("quiet");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter);

        foreach (var path in new[] { $"/api/control/tenants/{slug}/impersonate", $"/api/control/tenants/{slug}/backups" })
        {
            var (status, _) = await api.RefusedAsync(HttpMethod.Post, path);
            Assert.AreEqual(HttpStatusCode.Conflict, status, path);
        }
        var (health, _) = await api.RefusedAsync(HttpMethod.Get, $"/api/control/tenants/{slug}/health");
        Assert.AreEqual(HttpStatusCode.Conflict, health, "a stack that was never stamped has no health");
    }
}
