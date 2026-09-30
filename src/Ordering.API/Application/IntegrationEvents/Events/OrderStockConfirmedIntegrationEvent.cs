#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// What Catalog answered before it priced lines (now <see cref="OrderValidatedIntegrationEvent"/>).
/// Still read for one release, for answers queued when the stack was upgraded.
/// </summary>
public record OrderStockConfirmedIntegrationEvent(
    int OrderId,
    string? PromoCode = null,
    decimal PromoDiscount = 0,
    string? PromoReason = null) : IntegrationEvent
{
    /// <summary>
    /// Each product's menu category, by product id — what routes a line to
    /// its kitchen station. Null from publishers older than stations, whose
    /// lines all go to the default station.
    /// </summary>
    public Dictionary<int, int>? Categories { get; init; }
}
