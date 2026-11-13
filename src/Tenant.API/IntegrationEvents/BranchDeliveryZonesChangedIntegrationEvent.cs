using Ninja.EventBus.Events;

namespace Ninja.Tenant.API.IntegrationEvents;

/// <summary>
/// A branch's whole list of named delivery areas as it now stands, in the owner's order. Sent
/// through the outbox when the list is saved and only then: the areas' shapes are too much to carry
/// on <see cref="BranchSettingsChangedIntegrationEvent"/>, which goes out at every shift. With
/// <see cref="Version"/> to order two that cross; a consumer replaces what it holds for the branch.
/// </summary>
public record BranchDeliveryZonesChangedIntegrationEvent(
    int BranchId,
    IReadOnlyList<BranchDeliveryZone> Zones,
    // When the list was saved (ticks, UTC): a consumer keeps the newest it has seen
    long Version) : IntegrationEvent;

/// <summary>One named area: what it is called, what it asks, and its shape on the map when it has one.</summary>
public record BranchDeliveryZone(
    int Id,
    LocalizedText Name,
    decimal Fee,
    decimal? MinimumOrder,
    int? EtaMinutes,
    bool IsOn,
    // [lat, lng] points round it; null when the area is only a name
    double[][]? Shape,
    int SortOrder);
