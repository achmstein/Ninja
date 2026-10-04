namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Consumer copy of the event Identity publishes whenever a staff account is
/// made, changed, given branches or roles, disabled or removed. Same type
/// name as the source, since the routing key is the type name. Ordering keeps
/// the riders among them, so the till offers and checks riders without ever
/// calling Identity.
/// </summary>
/// <param name="Roles">Its realm roles: "Rider" among them for a rider.</param>
/// <param name="Branches">The branches the owner gave it.</param>
/// <param name="Enabled">False for an account disabled or removed.</param>
public record StaffAccountChangedIntegrationEvent(
    string UserId,
    string Name,
    string[] Roles,
    int[] Branches,
    bool Enabled) : IntegrationEvent;
