using Ninja.Branch.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Branch.API.IntegrationEvents;

/// <summary>
/// The café's own settings as they stand — the ones that belong to the café
/// and not to any one branch, so a branch opened tomorrow has them too. Goes
/// out when the owner changes one and once every time the service starts, so
/// a consumer that has never heard of them catches up without anyone
/// touching a switch. Ordering keeps its own copy.
/// </summary>
public record TenantSettingsChangedIntegrationEvent(bool GuestOrdersAnywhere) : IntegrationEvent
{
    public static TenantSettingsChangedIntegrationEvent From(Tenant tenant) => new(tenant.GuestOrdersAnywhere);
}
