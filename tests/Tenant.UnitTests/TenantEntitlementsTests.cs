using Ninja.Tenant.API.Model;

namespace Ninja.Tenant.UnitTests;

/// <summary>An owner may switch an entitled module off, never an unentitled one on; the plan is the ceiling.</summary>
[TestClass]
public sealed class TenantEntitlementsTests
{
    private static readonly TenantFeatures AllOn = new(true, true, true, true, true, true, true, true, true, true, PayAhead: true);
    private static readonly TenantFeatures NoInventory = AllOn with { Inventory = false };

    [TestMethod]
    public void A_fresh_tenant_is_entitled_to_everything_and_has_everything_on_but_pay_at_table()
    {
        var tenant = new API.Model.Tenant();
        Assert.AreEqual(AllOn, tenant.Entitlements, "the dev host and a stack stamped before plans keep every switch usable");
        Assert.AreEqual(AllOn with { OnlinePayments = false, PayAhead = false }, tenant.Features, "online payments waits for the owner (and the business's payment keys), and paying ahead with it");
    }

    [TestMethod]
    public void Pay_at_table_is_switched_within_its_entitlement_and_a_caller_that_does_not_know_it_leaves_it_off()
    {
        var tenant = new API.Model.Tenant();
        tenant.ApplyFeatures(AllOn);
        Assert.IsTrue(tenant.OnlinePaymentsEnabled);

        // A control plane older than online payments sends eight switches: the add-on is not bought
        tenant.ApplyEntitlements(new TenantFeatures(true, true, true, true, true, true, true, true));
        Assert.IsFalse(tenant.OnlinePaymentsEntitled);
        Assert.IsFalse(tenant.OnlinePaymentsEnabled, "the plan no longer allows it");
        tenant.ApplyFeatures(AllOn);
        Assert.IsFalse(tenant.OnlinePaymentsEnabled, "an owner never turns on what is not bought");
    }

    [TestMethod]
    public void Delivery_starts_on_goes_off_with_the_plan_and_a_caller_that_does_not_know_it_leaves_it_off()
    {
        var tenant = new API.Model.Tenant();
        Assert.IsTrue(tenant.DeliveryEnabled, "the dev host and a stack nobody told keep delivering");

        // Not bought: off, and the owner cannot turn it back on
        tenant.ApplyEntitlements(AllOn with { Delivery = false });
        Assert.IsFalse(tenant.DeliveryEnabled);
        tenant.ApplyFeatures(AllOn);
        Assert.IsFalse(tenant.DeliveryEnabled, "an owner never turns on what is not bought");

        // Bought again: on at once, without the owner having to find the switch
        tenant.ApplyEntitlements(AllOn);
        Assert.IsTrue(tenant.DeliveryEnabled, "delivery starts on the moment it is bought");

        // Kept bought: the owner's own off stays off at the next push
        tenant.ApplyFeatures(new FeatureSwitches(Delivery: false));
        tenant.ApplyEntitlements(AllOn);
        Assert.IsFalse(tenant.DeliveryEnabled, "only newly bought turns it on");
    }

    [TestMethod]
    public void A_switch_the_owner_did_not_send_stays_as_it_is()
    {
        var tenant = new API.Model.Tenant();
        Assert.IsTrue(tenant.DeliveryEnabled);

        // An admin older than delivery sends nine switches and not this one
        tenant.ApplyFeatures(new FeatureSwitches(true, true, true, true, true, true, true, true, true));
        Assert.IsTrue(tenant.DeliveryEnabled, "not knowing a switch never turns it off");

        tenant.ApplyFeatures(new FeatureSwitches(Inventory: false));
        Assert.IsFalse(tenant.InventoryEnabled);
        Assert.IsTrue(tenant.FinanceEnabled, "the others as they were");

        tenant.ApplyFeatures((FeatureSwitches?)null);
        Assert.IsFalse(tenant.InventoryEnabled, "nothing sent changes nothing");
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
