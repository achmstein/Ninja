using System.Net;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.FunctionalTests;

/// <summary>The record behind a tenant: its names, contact, locale, domain, demo expiry — and what the API refuses to write.</summary>
[TestClass]
public sealed class RecordScenarios
{
    private static UpdateTenantRequest Record(string? nameEn, string? plan = null, string? customerDomain = null, string? primaryColor = null, string? nameAr = "كافيه")
        => new(nameEn, nameAr, primaryColor, customerDomain, "Mona", "+201000000000", "Zamalek", plan is null ? null : Enum.Parse<TenantPlan>(plan), "VIP", "EG", "EGP", "Africa/Cairo", "ar");

    [TestMethod]
    public async Task The_record_is_edited_and_a_plan_given_there_goes_the_subscriptions_way()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("record");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        var updated = await api.UpdateAsync(slug, Record("Blue Café", plan: "Pro", primaryColor: "#1E90FF"));
        Assert.AreEqual("Blue Café", updated.NameEn);
        Assert.AreEqual("كافيه", updated.NameAr);
        Assert.AreEqual("#1e90ff", updated.PrimaryColor, "the colour is kept lower-case");
        Assert.AreEqual("Mona", updated.Record.ContactName);
        Assert.AreEqual(TenantPlan.Pro, updated.Record.Plan);
        Assert.AreEqual("EGP", updated.Locale.Currency);

        var tenant = await api.SettledAsync(slug);
        Assert.Contains($"{slug}-inventory-api:", Api.ComposeOnDisk(slug), "the plan given on the record reached the stack");
        var audit = await api.AuditAsync(slug);
        Assert.IsTrue(audit.Any(a => a.Action == "tenant.updated"));
        Assert.IsTrue(audit.Any(a => a.Action == "subscription.changed"));
        Assert.AreEqual(TenantStatus.Running, tenant.Status);
    }

    [TestMethod]
    public async Task A_business_own_domain_reaches_the_edge_straight_away_and_belongs_to_one_tenant()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("domain");
        var other = Api.Slug("other");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.CreateAsync(other, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        await api.SettledAsync(other);
        var domain = $"{slug}.example.com";

        var updated = await api.UpdateAsync(slug, Record("Domain Café", customerDomain: domain));
        Assert.AreEqual(domain, updated.CustomerDomain);
        Assert.Contains(domain, updated.Hosts.Customer, "the customer host moves to the business's own domain");
        await api.SettledAsync(slug);
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "tenant.edge.done"), "the edge was rewritten for it");

        var (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{other}", Record("Other Café", customerDomain: domain));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("already belongs to another tenant", detail);
    }

    [TestMethod]
    public async Task Only_demos_expire_and_an_extension_counts_from_the_later_of_now_and_the_expiry()
    {
        var api = Api.AsPlatformAdmin();
        var demo = Api.Slug("extend");
        var customer = Api.Slug("nodemo");
        var created = await api.CreateAsync(demo, TenantKind.Demo, TenantPlan.Free);
        await api.CreateAsync(customer, TenantKind.Customer, TenantPlan.Starter);
        var expiresAt = created.ExpiresAt!.Value;

        var extended = await api.ExtendAsync(demo, 30);
        Api.AssertSameInstant(expiresAt.AddDays(30), extended.ExpiresAt, "a demo still in its days keeps them and gets thirty more");
        Assert.IsTrue((await api.AuditAsync(demo)).Any(a => a.Action == "demo.extended"));

        var (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{customer}/extend", new { days = 30 });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("Only demos expire", detail);
    }

    [TestMethod]
    public async Task The_record_refuses_what_it_cannot_keep()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("badrec");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}", Record("  ", nameAr: " "));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("name is required", detail);

        // A business named in Arabic only keeps no English name
        (status, _) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}", Record(null));
        Assert.AreEqual(HttpStatusCode.OK, status);

        (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}", Record("Café", primaryColor: "blue"));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("#rrggbb", detail);

        (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}", Record("Café", customerDomain: $"{slug}.ninja.test"));
        Assert.AreEqual(HttpStatusCode.BadRequest, status, "the platform's own host is not a custom domain");

        (status, _) = await api.RefusedAsync(HttpMethod.Put, "/api/control/tenants/nobody-here", Record("Café"));
        Assert.AreEqual(HttpStatusCode.NotFound, status);

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, "/api/control/tenants", new { nameEn = "Taken", ownerEmail = "o@x.test", slug, provision = false });
        Assert.AreEqual(HttpStatusCode.Conflict, status, "a slug is one tenant's");
    }

    /// <summary>
    /// A business's own app: the build reads its record as the app-builder client and can do nothing else
    /// with that login, and its customer host answers the app's link files once the record says enough.
    /// </summary>
    [TestMethod]
    public async Task The_build_reads_the_apps_record_and_its_host_serves_the_apps_links()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("ownapp");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter);
        var fingerprint = string.Join(':', Enumerable.Repeat("AB", 32));
        await api.UpdateAsync(slug, Record("Blue Café") with { AppId = $"net.ninjapp.{slug.Replace('-', '_')}", AppleTeamId = "ABCDE12345", AndroidCertFingerprints = fingerprint });

        var build = api.As("AppBuilder");
        using (var config = await build.GetAsync($"/api/control/tenants/{slug}/app-config"))
        {
            Assert.AreEqual(HttpStatusCode.OK, config.StatusCode, "the build reads the record");
            var record = System.Text.Json.Nodes.JsonNode.Parse(await config.Content.ReadAsStringAsync())!;
            Assert.AreEqual(slug, record["REALM"]!.GetValue<string>());
            Assert.AreEqual("ABCDE12345", record["APPLE_TEAM_ID"]!.GetValue<string>());
        }
        using (var other = await build.GetAsync($"/api/control/tenants/{slug}"))
            Assert.AreEqual(HttpStatusCode.Forbidden, other.StatusCode, "and nothing else");
        using (var nobody = await api.Anonymous().GetAsync($"/api/control/tenants/{slug}/app-config"))
            Assert.AreEqual(HttpStatusCode.Unauthorized, nobody.StatusCode);
        using (var missing = await build.GetAsync("/api/control/tenants/nobody-here/app-config"))
            Assert.AreEqual(HttpStatusCode.NotFound, missing.StatusCode, "a business not on the platform: the build keeps the record it has");

        // The edge passes the customer host on; nobody signs in for these
        var anonymous = api.Anonymous();
        using var assetLinks = new HttpRequestMessage(HttpMethod.Get, "/api/control/app-links/assetlinks.json") { Headers = { Host = $"{slug}.ninja.test" } };
        using (var android = await anonymous.SendAsync(assetLinks))
        {
            Assert.AreEqual(HttpStatusCode.OK, android.StatusCode);
            StringAssert.Contains(await android.Content.ReadAsStringAsync(), fingerprint);
        }
        using var association = new HttpRequestMessage(HttpMethod.Get, "/api/control/app-links/apple-app-site-association") { Headers = { Host = $"{slug}.ninja.test" } };
        using (var ios = await anonymous.SendAsync(association))
        {
            Assert.AreEqual(HttpStatusCode.OK, ios.StatusCode);
            Assert.AreEqual("application/json", ios.Content.Headers.ContentType?.MediaType, "Apple takes the file only as JSON");
            StringAssert.Contains(await ios.Content.ReadAsStringAsync(), $"ABCDE12345.net.ninjapp.{slug.Replace('-', '_')}");
        }
        using var adminHost = new HttpRequestMessage(HttpMethod.Get, "/api/control/app-links/assetlinks.json") { Headers = { Host = $"admin.{slug}.ninja.test" } };
        using (var staff = await anonymous.SendAsync(adminHost))
            Assert.AreEqual(HttpStatusCode.NotFound, staff.StatusCode, "a staff host serves no customer app");
    }
}
