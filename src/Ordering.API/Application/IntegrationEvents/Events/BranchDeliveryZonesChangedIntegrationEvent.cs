#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Tenant.API publishes when a branch's list of named delivery areas is
/// saved: the whole list as it now stands, in the owner's order. Same type name and properties as
/// the source — the routing key is the type name.
/// </summary>
public record BranchDeliveryZonesChangedIntegrationEvent(
    int BranchId,
    IReadOnlyList<BranchDeliveryZoneData> Zones,
    long Version) : IntegrationEvent;

/// <summary>One named area as the event carries it (Tenant.API's BranchDeliveryZone).</summary>
public record BranchDeliveryZoneData(
    int Id,
    LocalizedText Name,
    decimal Fee,
    decimal? MinimumOrder,
    int? EtaMinutes,
    bool IsOn,
    double[][]? Shape,
    int SortOrder);
