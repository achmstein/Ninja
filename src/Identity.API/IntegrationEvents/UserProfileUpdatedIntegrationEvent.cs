using System.Text.Json.Nodes;
using Ninja.EventBus.Events;

namespace Ninja.Identity.API.IntegrationEvents;

/// <summary>
/// A person's name or phone changed. DisplayName is the name as one line, what
/// every service shows; the first and last name and the phone come with it for
/// whoever keeps them apart. Older subscribers read DisplayName alone.
/// </summary>
public record UserProfileUpdatedIntegrationEvent(
    string UserId,
    string DisplayName,
    string? FirstName = null,
    string? LastName = null,
    string? PhoneNumber = null) : IntegrationEvent
{
    /// <summary>The profile as Keycloak now holds it, from the user representation just saved</summary>
    public static UserProfileUpdatedIntegrationEvent From(string userId, JsonObject user)
    {
        var firstName = Clean((string?)user["firstName"]);
        var lastName = Clean((string?)user["lastName"]);
        var phone = Clean((string?)((user["attributes"] as JsonObject)?["phoneNumber"] as JsonArray)?.FirstOrDefault());
        return new(userId, PersonName.Display(firstName, lastName), firstName, lastName, phone);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
