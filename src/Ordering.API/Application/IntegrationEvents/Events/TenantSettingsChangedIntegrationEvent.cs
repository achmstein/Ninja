namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Branch.API publishes when one of the café's own
/// settings changes, and once every time it starts. Same type name and
/// properties as the source — the routing key is the type name.
/// </summary>
public record TenantSettingsChangedIntegrationEvent(bool GuestOrdersAnywhere) : IntegrationEvent;
