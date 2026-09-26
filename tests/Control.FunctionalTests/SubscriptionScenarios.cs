using System.Net;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.FunctionalTests;

/// <summary>
/// What a café pays for, through the API: a demo has everything; converting
/// it puts it on a plan, and the stack follows the plan up, down, while
/// stopped, and add-on by add-on.
/// </summary>
[TestClass]
public sealed class SubscriptionScenarios
{
    private static readonly string[] ModuleServices = ["inventory", "finance", "payroll", "loyalty", "accounts"];

    private static void AssertStamped(string slug, params string[] moduleServices)
    {
        var yaml = Api.ComposeOnDisk(slug);
        foreach (var service in ModuleServices)
        {
            if (moduleServices.Contains(service)) Assert.Contains($"  {slug}-{service}-api:", yaml, $"{service} is in {slug}'s plan");
            else Assert.DoesNotContain($"  {slug}-{service}-api:", yaml, $"{service} is not in {slug}'s plan");
        }
        Assert.Contains($"  {slug}-spaces-api:", yaml, "spaces always runs");
        Assert.Contains($"  {slug}-gateway:", yaml);
    }

    private static string[] Steps(Ninja.Control.API.Apis.TenantDetail tenant) => tenant.Steps.Select(s => $"{s.Name}:{s.Status}").ToArray();

    [TestMethod]
    public async Task A_demo_is_stamped_with_everything_whatever_plan_it_is_on()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("demo");

        var created = await api.CreateAsync(slug, TenantKind.Demo, TenantPlan.Free, provision: true);
        Assert.AreEqual(TenantKind.Demo, created.Kind);
        Assert.IsNotNull(created.ExpiresAt, "a demo expires");

        var tenant = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, tenant.Status, tenant.LastError);
        AssertStamped(slug, ModuleServices);
        Assert.AreEqual("everything", tenant.Steps.Single(s => s.Name == "entitlements").Output);
        CollectionAssert.AreEquivalent(PlanCatalog.All.ToArray(), tenant.Subscription.Entitlements.ToArray(), "a prospect sees the whole product");
        Assert.IsTrue((await api.AuditAsync(slug)).Any(a => a.Action == "tenant.provision.done"));
    }

    [TestMethod]
    public async Task Converting_a_demo_to_starter_takes_the_module_services_away_with_their_queues()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("convert");
        await api.CreateAsync(slug, TenantKind.Demo, TenantPlan.Free, provision: true);
        await api.SettledAsync(slug);
        ControlPlane.Factory.Broker.DeletedQueues.Clear();

        var converted = await api.ConvertAsync(slug);
        Assert.AreEqual(TenantKind.Customer, converted.Kind);
        Assert.AreEqual(TenantPlan.Starter, converted.Record.Plan, "a free demo converts to Starter unless told otherwise");
        Assert.IsNull(converted.ExpiresAt);

        var tenant = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, tenant.Status, tenant.LastError);
        CollectionAssert.AreEqual(new[] { "stack:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps(tenant));
        AssertStamped(slug, "loyalty", "accounts");
        CollectionAssert.AreEquivalent(new[] { $"{slug}/Inventory", $"{slug}/Payroll", $"{slug}/Finance" }, ControlPlane.Factory.Broker.DeletedQueues.Where(q => q.StartsWith($"{slug}/")).ToArray());

        var subscription = await api.SubscriptionAsync(slug);
        CollectionAssert.AreEquivalent(new[] { Module.Reservations, Module.TimeBilling, Module.Loyalty, Module.Tabs, Module.Kds }, subscription.Entitlements);
        CollectionAssert.AreEquivalent(new[] { Module.Inventory, Module.Finance, Module.Payroll, Module.OnlinePayments }, subscription.AddonsAvailable);
        Assert.IsTrue(ControlPlane.Factory.Shell.Commands.Any(c => c.Contains($"compose -p ninja-{slug} up -d --remove-orphans")), "the containers that left the plan go as orphans");
    }

    [TestMethod]
    public async Task An_addon_brings_its_service_back_and_dropping_it_takes_it_away_again()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("addon");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        AssertStamped(slug, "loyalty", "accounts");

        var bought = await api.SetSubscriptionAsync(slug, TenantPlan.Starter, [Module.Inventory]);
        CollectionAssert.AreEqual(new[] { Module.Inventory }, bought.Addons);
        var tenant = await api.SettledAsync(slug);
        AssertStamped(slug, "loyalty", "accounts", "inventory");
        Assert.AreEqual($"Payroll, Finance off vhost {slug}", tenant.Steps.Single(s => s.Name == "queues").Output, "the bought module's queue is left to its consumer");

        await api.SetSubscriptionAsync(slug, TenantPlan.Starter, []);
        tenant = await api.SettledAsync(slug);
        AssertStamped(slug, "loyalty", "accounts");
        Assert.AreEqual($"Inventory, Payroll, Finance off vhost {slug}", tenant.Steps.Single(s => s.Name == "queues").Output);
        Assert.IsTrue((await api.AuditAsync(slug)).Count(a => a.Action == "subscription.changed") >= 2);
    }

    [TestMethod]
    public async Task Saving_the_same_plan_again_still_pushes_the_entitlements()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("resave");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);
        var before = (await api.AuditAsync(slug)).Count(a => a.Action == "tenant.entitlements.done");

        await api.SetSubscriptionAsync(slug, TenantPlan.Starter, []);
        await api.SettledAsync(slug);

        Assert.AreEqual(before + 1, (await api.AuditAsync(slug)).Count(a => a.Action == "tenant.entitlements.done"), "a stack that drifted is set right by a save");
    }

    [TestMethod]
    public async Task A_plan_that_changes_while_the_stack_is_stopped_is_applied_on_start()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("stopped");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter, provision: true);
        await api.SettledAsync(slug);

        await api.StopAsync(slug);
        var stopped = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Stopped, stopped.Status);

        await api.SetSubscriptionAsync(slug, TenantPlan.Pro);
        var changed = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Stopped, changed.Status, "a plan change does not start a stopped stack");
        CollectionAssert.AreEqual(new[] { "stack:Done", "queues:Done" }, Steps(changed), "no health and no push while the stack is down");
        Assert.AreEqual("files rewritten; applied on start", changed.Steps.Single(s => s.Name == "stack").Output);
        AssertStamped(slug, ModuleServices);

        await api.StartAsync(slug);
        var started = await api.SettledAsync(slug);
        Assert.AreEqual(TenantStatus.Running, started.Status, started.LastError);
        CollectionAssert.AreEqual(new[] { "start:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps(started));
        Assert.AreEqual("reservations, timeBilling, loyalty, tabs, inventory, finance, payroll, kds", started.Steps.Single(s => s.Name == "entitlements").Output, "everything but online payments, an add-on on every plan");
    }

    [TestMethod]
    public async Task Down_to_free_takes_five_services_and_their_queues()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("free");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Pro, provision: true);
        await api.SettledAsync(slug);
        AssertStamped(slug, ModuleServices);

        await api.SetSubscriptionAsync(slug, TenantPlan.Free);
        var tenant = await api.SettledAsync(slug);

        AssertStamped(slug);
        Assert.AreEqual($"Inventory, Payroll, Finance, Loyalty, Accounts off vhost {slug}", tenant.Steps.Single(s => s.Name == "queues").Output);
        Assert.AreEqual("kds", tenant.Steps.Single(s => s.Name == "entitlements").Output);
        var yaml = Api.ComposeOnDisk(slug);
        Assert.Contains("/api/tenant/module-off", yaml, "the gateway answers 402 for what is not in the plan");
        Assert.DoesNotContain("/health/inventory", yaml, "no probe for a service that is not there");
    }

    [TestMethod]
    public async Task The_api_refuses_what_it_should()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("refuse");
        await api.CreateAsync(slug, TenantKind.Demo, TenantPlan.Free);

        var (status, detail) = await api.RefusedAsync(HttpMethod.Put, $"/api/control/tenants/{slug}/subscription", new { plan = "Starter", graceDays = 91 });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("Grace days", detail);

        (status, detail) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/subscription/payments", new { amount = 100, currency = "EGP", periodEnd = DateTimeOffset.UtcNow.AddMonths(1) });
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("Convert the demo", detail);

        (status, _) = await api.RefusedAsync(HttpMethod.Post, $"/api/control/tenants/{slug}/stop");
        Assert.AreEqual(HttpStatusCode.Conflict, status, "a tenant that was never stamped cannot be stopped");

        using var anonymous = api.Anonymous();
        using var response = await anonymous.GetAsync("/api/control/tenants");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode, "the door is locked");
    }
}
