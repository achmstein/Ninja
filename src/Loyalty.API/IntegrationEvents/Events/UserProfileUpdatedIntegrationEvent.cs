using Ninja.EventBus.Events;

namespace Ninja.Loyalty.API.IntegrationEvents.Events;

// FirstName, LastName and PhoneNumber come from newer publishers; DisplayName is always there
public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName,
    string? FirstName = null,
    string? LastName = null,
    string? PhoneNumber = null) : IntegrationEvent;
