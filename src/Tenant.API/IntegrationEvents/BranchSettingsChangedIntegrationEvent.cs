using Ninja.EventBus.Events;

namespace Ninja.Tenant.API.IntegrationEvents;

/// <summary>
/// A branch's flags and delivery terms as they now stand. Sent through the outbox
/// (see TenantEvents), with <see cref="Version"/> to order two of them that cross.
/// </summary>
public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders = false,
    bool IsDeliveryEnabled = false,
    double? Latitude = null,
    double? Longitude = null,
    decimal? DeliveryRadiusKm = null,
    decimal DeliveryFee = 0,
    decimal DeliveryMinimumOrder = 0,
    // When the branch's settings were saved (ticks, UTC): a consumer keeps the newest it has seen
    long Version = 0,
    // Customers must be signed in to order delivery here (the till's phone orders are not)
    bool RequireSignInForDelivery = false,
    // Still one of the business's branches: one switched off delivers nothing and is offered to nobody
    bool IsActive = true,
    // The area drawn on the map, [lat, lng] points round it; null for none. When there is one it, not the radius, says where the branch delivers
    double[][]? DeliveryArea = null) : IntegrationEvent;
