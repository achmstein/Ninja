using System.Text.RegularExpressions;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>Plans and add-ons become entitlements; the gateway blocks what is not entitled; the sweep suspends what is not paid.</summary>
[TestClass]
public sealed class SubscriptionTests
{
    private static readonly PlatformOptions Platform = new() { Domain = "ninja.app", ControlUrl = "https://control.ninja.app", KeycloakPublicUrl = "https://auth.ninja.app" };

    private static Tenant Customer(TenantPlan plan, params Module[] addons) => new()
    {
        Slug = "blue",
        NameEn = "Blue",
        Kind = TenantKind.Customer,
        Plan = plan,
        Addons = addons,
        OwnerEmail = "owner@blue.test",
        IdentitySecret = "identity-secret-1234567890123456",
        ControlSecret = "control-secret-12345678901234567",
        DbPassword = "db-password-123456789012345678",
        BrokerPassword = "broker-password-1234567890123456",
    };

    [TestMethod]
    public void Free_includes_only_kds_starter_the_floor_and_pro_everything()
    {
        CollectionAssert.AreEquivalent(new[] { Module.Kds }, PlanCatalog.Included(TenantPlan.Free).ToArray());
        CollectionAssert.AreEquivalent(new[] { Module.Rooms, Module.Loyalty, Module.Tabs, Module.Kds }, PlanCatalog.Included(TenantPlan.Starter).ToArray());
        Assert.IsTrue(PlanCatalog.Included(TenantPlan.Pro).SetEquals(PlanCatalog.All));
        Assert.IsEmpty(PlanCatalog.AddonsAvailable(TenantPlan.Pro));
        CollectionAssert.AreEquivalent(new[] { Module.Inventory, Module.Finance, Module.Payroll }, PlanCatalog.AddonsAvailable(TenantPlan.Starter).ToArray());
    }

    [TestMethod]
    public void Entitlements_are_the_plan_plus_the_addons_and_everything_for_a_demo()
    {
        var starterWithInventory = PlanCatalog.Entitlements(TenantPlan.Starter, [Module.Inventory], TenantKind.Customer);
        CollectionAssert.AreEquivalent(new[] { Module.Rooms, Module.Loyalty, Module.Tabs, Module.Kds, Module.Inventory }, starterWithInventory.ToArray());
        Assert.IsTrue(PlanCatalog.Entitlements(TenantPlan.Free, [], TenantKind.Demo).SetEquals(PlanCatalog.All), "a prospect sees the whole product");
    }

    [TestMethod]
    public void Normalizing_drops_addons_the_plan_includes_and_duplicates()
    {
        CollectionAssert.AreEqual(new[] { Module.Inventory, Module.Finance }, PlanCatalog.NormalizeAddons(TenantPlan.Starter, [Module.Finance, Module.Rooms, Module.Inventory, Module.Finance]));
        Assert.IsEmpty(PlanCatalog.NormalizeAddons(TenantPlan.Pro, [Module.Inventory]));
    }

    [TestMethod]
    public void The_features_object_spells_the_switches_the_way_branch_api_does()
    {
        var features = PlanCatalog.ToFeatures(PlanCatalog.Entitlements(TenantPlan.Starter, [], TenantKind.Customer));
        Assert.IsTrue(features["rooms"]!.GetValue<bool>());
        Assert.IsFalse(features["inventory"]!.GetValue<bool>());
        CollectionAssert.AreEquivalent(new[] { "rooms", "loyalty", "tabs", "inventory", "finance", "payroll", "kds" }, features.Select(f => f.Key).ToArray());
    }

    [TestMethod]
    public void The_gateway_sends_an_unentitled_module_to_the_402_page_and_leaves_the_rest_alone()
    {
        var tenant = Customer(TenantPlan.Starter);
        var yaml = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform);

        // Inventory is not in Starter: same path, Branch.API's page, the module named, first in line
        var inventory = Regex.Match(yaml, @"REVERSEPROXY__ROUTES__(route\d+)__MATCH__PATH: ""/api/inventory/\{\*any\}""").Groups[1].Value;
        Assert.IsFalse(string.IsNullOrEmpty(inventory), "the inventory path is still routed");
        Assert.Contains($"{inventory}__CLUSTERID: \"branch\"", yaml);
        Assert.Contains($"{inventory}__ORDER: \"-1\"", yaml);
        Assert.Contains($"{inventory}__TRANSFORMS__0__PathSet: \"/api/tenant/module-off\"", yaml);
        Assert.Contains($"{inventory}__TRANSFORMS__1__QueryValueParameter: \"module\"", yaml);
        Assert.Contains($"{inventory}__TRANSFORMS__1__Set: \"inventory\"", yaml);
        Assert.DoesNotContain($"{inventory}__MATCH__QUERYPARAMETERS", yaml, "every api-version gets the 402");

        // Rooms is in Starter: the stays and the room-only place routes are not blocked, /api/places goes to spaces
        Assert.DoesNotContain("/api/places/{id}/hold", yaml);
        var places = Regex.Match(yaml, @"REVERSEPROXY__ROUTES__(route\d+)__MATCH__PATH: ""/api/places/\{\*any\}""").Groups[1].Value;
        Assert.Contains($"{places}__CLUSTERID: \"spaces\"", yaml);
        // Every container still runs and is still probed
        Assert.Contains("REVERSEPROXY__CLUSTERS__inventory__DESTINATIONS__d1__ADDRESS", yaml);
        Assert.Contains("/health/inventory", yaml);
    }

    [TestMethod]
    public void Free_blocks_stays_and_the_room_only_place_routes_but_not_places_itself()
    {
        var tenant = Customer(TenantPlan.Free);
        var yaml = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform);
        Assert.Contains("__MATCH__PATH: \"/api/places/{id}/hold\"", yaml);
        Assert.Contains("__MATCH__PATH: \"/api/places/available\"", yaml);
        var stays = Regex.Match(yaml, @"REVERSEPROXY__ROUTES__(route\d+)__MATCH__PATH: ""/api/stays/\{\*any\}""").Groups[1].Value;
        Assert.Contains($"{stays}__CLUSTERID: \"branch\"", yaml);
        Assert.Contains($"{stays}__TRANSFORMS__1__Set: \"rooms\"", yaml);
        var places = Regex.Match(yaml, @"REVERSEPROXY__ROUTES__(route\d+)__MATCH__PATH: ""/api/places/\{\*any\}""").Groups[1].Value;
        Assert.Contains($"{places}__CLUSTERID: \"spaces\"", yaml, "tables and stations live under /api/places");
    }

    [TestMethod]
    public void A_fully_entitled_tenant_renders_the_plain_route_table()
    {
        var demo = Customer(TenantPlan.Free);
        demo.Kind = TenantKind.Demo;
        foreach (var tenant in new[] { Customer(TenantPlan.Pro), demo })
        {
            var yaml = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform);
            Assert.DoesNotContain("module-off", yaml);
            Assert.DoesNotContain("__ORDER", yaml);
        }
        CollectionAssert.AreEqual(Templates.GatewayRoutes().Select(r => r.Path).ToList(), Templates.GatewayRoutes(PlanCatalog.All).Select(r => r.Path).ToList());
    }

    [TestMethod]
    public void The_sweep_tells_a_customer_past_its_period_and_suspends_past_its_grace()
    {
        var today = new DateOnly(2026, 9, 20);
        static Tenant Paid(int daysAgo, SubscriptionStatus status = SubscriptionStatus.Active, TenantStatus stack = TenantStatus.Running, int? grace = null)
            => new() { Kind = TenantKind.Customer, Status = stack, Subscription = status, GraceDays = grace, PaidThrough = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero).AddDays(-daysAgo) };

        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(new Tenant { Kind = TenantKind.Demo, PaidThrough = DateTimeOffset.UtcNow.AddYears(-1) }, today, 7));
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(new Tenant { Kind = TenantKind.Customer }, today, 7), "nobody is counting yet");
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(0), today, 7), "paid through today holds through today");
        Assert.AreEqual(SweepDecision.PastDue, SubscriptionSweep.Decide(Paid(1), today, 7));
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(3, SubscriptionStatus.PastDue), today, 7), "told once, grace running");
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(7, SubscriptionStatus.PastDue), today, 7), "the last day of grace");
        Assert.AreEqual(SweepDecision.Suspend, SubscriptionSweep.Decide(Paid(8, SubscriptionStatus.PastDue), today, 7));
        Assert.AreEqual(SweepDecision.Suspend, SubscriptionSweep.Decide(Paid(8), today, 7), "grace over counts even if the notice never went");
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(8, SubscriptionStatus.Suspended, TenantStatus.Suspended), today, 7));
        Assert.AreEqual(SweepDecision.None, SubscriptionSweep.Decide(Paid(30, SubscriptionStatus.Cancelled), today, 7));
        Assert.AreEqual(SweepDecision.PastDue, SubscriptionSweep.Decide(Paid(8, grace: 30), today, 7), "the row's own grace wins");
    }
}
