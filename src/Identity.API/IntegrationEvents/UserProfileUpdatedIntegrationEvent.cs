using Ninja.EventBus.Events;

namespace Ninja.Identity.API.IntegrationEvents;

public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName) : IntegrationEvent;
