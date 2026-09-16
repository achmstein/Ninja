using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a place is created,
/// changed or deleted. Notification keeps a projection off it so a service
/// request is allowed by what the place can do, not by what the client says.
/// </summary>
public record PlaceUpdatedIntegrationEvent(
    int PlaceId,
    string Kind,
    LocalizedText Name,
    int BranchId,
    bool IsTimed,
    bool HasOptions,
    bool IsActive,
    int? LegacyRoomId = null,
    int? LegacyTableId = null,
    bool Deleted = false) : IntegrationEvent;
