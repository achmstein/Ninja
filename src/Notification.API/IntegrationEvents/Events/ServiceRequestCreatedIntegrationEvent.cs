using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record ServiceRequestCreatedIntegrationEvent(
    int RequestId,
    string UserName,
    // LEGACY(places): old RoomId/RoomName (and TableId/TableName below) beside PlaceId/PlaceKind — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    ServiceRequestType RequestType,
    DateTime CreatedAt,
    int BranchId = 1,
    int? TableId = null,
    LocalizedText? TableName = null,
    int? PlaceId = null,
    string? PlaceKind = null,
    string? OptionCode = null) : IntegrationEvent;
