using Ninja.EventBus.Events;

namespace Ninja.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Branch.API publishes whenever the café's
/// switches change (the owner on the brand page, or the plan from the
/// control plane). Same type name as the source — the routing key is the
/// type name — and only the two switches Spaces owns a part of.
/// </summary>
public record TenantFeaturesChangedIntegrationEvent(
    bool Reservations,
    bool TimeBilling) : IntegrationEvent;
