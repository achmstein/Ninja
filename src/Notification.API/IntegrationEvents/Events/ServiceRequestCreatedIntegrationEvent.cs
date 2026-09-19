using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record ServiceRequestCreatedIntegrationEvent(
    int RequestId,
    string UserName,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    ServiceRequestType RequestType,
    DateTime CreatedAt,
    int BranchId,
    string? OptionCode = null) : IntegrationEvent;
