using Ninja.Tenant.API.Model;

namespace Ninja.Tenant.UnitTests;

/// <summary>An owner may switch an entitled module off, never an unentitled one on; the plan is the ceiling.</summary>
[TestClass]
public sealed class TenantEntitlementsTests
{
    private static readonly TenantFeatures AllOn = new(true, true, true, true, true, true, true, true);
    private static readonly TenantFeatures NoInventory = new(true, true, true, true, false, true, true, true);

    [TestMethod]
    public void A_fresh_tenant_is_entitled_to_everything_and_has_everything_on()
    {
        var tenant = new API.Model.Tenant();
        Assert.AreEqual(AllOn, tenant.Entitlements, "the dev host and a stack stamped before plans keep every switch usable");
        Assert.AreEqual(AllOn, tenant.Features);
    }

    [TestMethod]
    public void The_clamp_never_turns_on_a_module_that_is_not_entitled()
    {
        var tenant = new API.Model.Tenant();
        tenant.ApplyEntitlements(NoInventory);
        tenant.ApplyFeatures(AllOn);
        Assert.IsFalse(tenant.InventoryEnabled);
        Assert.IsTrue(tenant.FinanceEnabled);
    }

    [TestMethod]
    public void An_owner_can_switch_an_entitled_module_off()
    {
        var tenant = new API.Model.Tenant();
        tenant.ApplyFeatures(AllOn with { Reservations = false });
        Assert.IsFalse(tenant.ReservationsEnabled);
        Assert.IsTrue(tenant.ReservationsEntitled);
        Assert.IsTrue(tenant.TimeBillingEnabled, "the clock is its own switch");
    }

    [TestMethod]
    public void Applying_entitlements_reclamps_what_is_on_and_leaves_it_off_when_they_return()
    {
        var tenant = new API.Model.Tenant();
        Assert.IsTrue(tenant.InventoryEnabled);
        tenant.ApplyEntitlements(NoInventory);
        Assert.IsFalse(tenant.InventoryEnabled, "the plan no longer allows it");
        tenant.ApplyEntitlements(AllOn);
        Assert.IsFalse(tenant.InventoryEnabled, "entitled again, but nobody switched it back on");
        tenant.ApplyFeatures(AllOn);
        Assert.IsTrue(tenant.InventoryEnabled);
    }
}
