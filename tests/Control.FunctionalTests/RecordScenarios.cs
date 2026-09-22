using System.Net;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.FunctionalTests;

/// <summary>The record behind a tenant: its names, contact, locale, domain, demo expiry — and what the API refuses to write.</summary>
[TestClass]
public sealed class RecordScenarios
{
    private static UpdateTenantRequest Record(string nameEn, string? plan = null, string? customerDomain = null, string? primaryColor = null)
        => new(nameEn, "كافيه", primaryColor, customerDomain, "Mona", "+201000000000", "Zamalek", plan is null ? null : Enum.Parse<TenantPlan>(plan), "VIP", "EG", "EGP", "Africa/Cairo", "ar");

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
    public async Task A_cafes_own_domain_reaches_the_edge_straight_away_and_belongs_to_one_tenant()
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
        Assert.Contains(domain, updated.Hosts.Customer, "the customer host moves to the café's own domain");
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

        var (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}", Record("  "));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("English name", detail);

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
}
