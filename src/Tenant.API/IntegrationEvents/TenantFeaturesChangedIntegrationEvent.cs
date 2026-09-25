using Ninja.Tenant.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Tenant.API.IntegrationEvents;

/// <summary>
/// The nine switches as they stand after the brand or the plan changed:
/// what is on, within what the plan allows. A service that owns part of a
/// module keeps its own copy and refuses what is off, so a control the UI
/// hides is not one a hand-made request can still use.
/// </summary>
public record TenantFeaturesChangedIntegrationEvent(
    bool Reservations,
    bool TimeBilling,
    bool Loyalty,
    bool Tabs,
    bool Inventory,
    bool Finance,
    bool Payroll,
    bool Kds,
    bool PayAtTable = false) : IntegrationEvent
{
    public static TenantFeaturesChangedIntegrationEvent From(TenantFeatures f)
        => new(f.Reservations, f.TimeBilling, f.Loyalty, f.Tabs, f.Inventory, f.Finance, f.Payroll, f.Kds, f.PayAtTable);
}
