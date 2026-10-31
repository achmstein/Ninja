#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Identity publishes when a person's name or phone
/// changes. DisplayName is the name as one line; the others come from newer
/// publishers only.
/// </summary>
public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName,
    string? FirstName = null,
    string? LastName = null,
    string? PhoneNumber = null) : IntegrationEvent;
