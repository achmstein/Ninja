using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

/// <summary>
/// A partial view of Tenant.API's branch settings event, sent whenever a
/// branch is created or changed and each time a shift opens or closes there:
/// Finance reads only when the branch's day starts, to date what it books.
/// </summary>
public record BranchSettingsChangedIntegrationEvent : IntegrationEvent
{
    public int BranchId { get; init; }

    /// <summary>When the branch's day turns over, local time; null from a Tenant.API that did not send it yet.</summary>
    public TimeOnly? DayStartTime { get; init; }

    /// <summary>When the settings were saved (ticks, UTC): the newest wins.</summary>
    public long Version { get; init; }
}
