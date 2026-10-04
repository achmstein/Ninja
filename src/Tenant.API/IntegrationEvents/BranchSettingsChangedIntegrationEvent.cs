using Ninja.EventBus.Events;

namespace Ninja.Tenant.API.IntegrationEvents;

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
    decimal DeliveryMinimumOrder = 0) : IntegrationEvent;
