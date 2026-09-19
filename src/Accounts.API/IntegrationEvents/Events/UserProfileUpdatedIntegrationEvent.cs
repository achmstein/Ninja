using Ninja.EventBus.Events;

namespace Ninja.Accounts.API.IntegrationEvents.Events;

public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName) : IntegrationEvent;
