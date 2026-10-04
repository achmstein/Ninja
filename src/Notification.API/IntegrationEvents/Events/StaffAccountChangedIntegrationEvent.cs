using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Identity's event: a staff account as it stands now. A
/// rider switched off, gone, or no longer a rider stops getting pushes on
/// whatever phone they last signed in on.
/// </summary>
public record StaffAccountChangedIntegrationEvent(
    string UserId,
    string Name,
    string[] Roles,
    int[] Branches,
    bool Enabled) : IntegrationEvent;
