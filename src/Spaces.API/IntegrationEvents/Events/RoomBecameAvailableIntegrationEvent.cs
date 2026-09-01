using Chillax.EventBus.Events;

namespace Chillax.Spaces.API.IntegrationEvents.Events;

public record RoomBecameAvailableIntegrationEvent(int RoomId, string RoomName, int BranchId = 1) : IntegrationEvent;
