using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

public record RoomBecameAvailableIntegrationEvent(int RoomId, LocalizedText RoomName, int BranchId = 1) : IntegrationEvent;
