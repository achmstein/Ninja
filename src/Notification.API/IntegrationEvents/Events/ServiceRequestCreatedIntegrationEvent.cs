using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

public record ServiceRequestCreatedIntegrationEvent(
    int RequestId,
    string UserName,
    int RoomId,
    LocalizedText RoomName,
    ServiceRequestType RequestType,
    DateTime CreatedAt,
    int BranchId = 1,
    int? TableId = null,
    LocalizedText? TableName = null) : IntegrationEvent;
