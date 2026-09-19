using Ninja.EventBus.Events;

namespace Ninja.Loyalty.API.IntegrationEvents.Events;

public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName) : IntegrationEvent;
