namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Tenant.API publishes whenever the business's
/// switches change (the owner's, or what the plan allows). Same type name as
/// the source, since the routing key is the type name; only the switch
/// Ordering owns a part of is read.
/// </summary>
/// <param name="Delivery">Last and defaulted at the source: a Tenant.API older than delivery does not send it.</param>
/// <param name="PayAhead">Customers pay online for a delivery or an order they collect before the business sees it; a Tenant.API older than it does not send it.</param>
public record TenantFeaturesChangedIntegrationEvent(bool Delivery = false, bool PayAhead = false) : IntegrationEvent;
