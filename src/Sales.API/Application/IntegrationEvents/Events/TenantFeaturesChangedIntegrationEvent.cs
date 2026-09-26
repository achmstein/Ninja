#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Tenant.API publishes whenever the café's
/// switches change (the owner on the brand page, or the plan from the
/// control plane). Same type name as the source — the routing key is the
/// type name — and only the switch Sales owns a part of. Absent from an
/// older stack's event, it reads as off.
/// </summary>
public record TenantFeaturesChangedIntegrationEvent(
    bool OnlinePayments = false) : IntegrationEvent;
