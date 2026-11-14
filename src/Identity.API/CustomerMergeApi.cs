using System.Text.Json.Nodes;
using Ninja.EventBus.Abstractions;
using Ninja.Identity.API.Directory;
using Ninja.Identity.API.IntegrationEvents;
using Ninja.ServiceDefaults;

namespace Ninja.Identity.API;

/// <summary>
/// One person who signed up twice (two emails, or once at the counter and
/// once in the app) is two accounts, each with its own tab, points and
/// orders. The owner names the one to keep; the other is switched off and
/// signed out, its phone goes to the kept account when that one has none,
/// and every service is told to move what it kept under the first to the
/// second. It cannot be undone: two histories become one.
/// </summary>
public static class CustomerMergeApi
{
    private sealed class MergeLog;

    public static void MapCustomerMerge(this WebApplication app)
    {
        app.MapPost("/api/identity/users/{userId}/merge-into/{intoUserId}", async (
            string userId, string intoUserId, HttpContext http, KeycloakAdmin keycloak, UserDirectory directory, IEventBus eventBus, ILogger<MergeLog> logger) =>
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(intoUserId) || userId == intoUserId)
                return Results.BadRequest(new { message = "Choose two different customers." });

            var client = await keycloak.AuthorizedClientAsync();
            var from = await keycloak.GetUserAsync(client, userId);
            var into = await keycloak.GetUserAsync(client, intoUserId);
            if (from is null || into is null)
                return Results.NotFound(new { message = "Customer not found" });

            // Staff sign in from the same directory; a login is not a customer to fold into another
            foreach (var id in new[] { userId, intoUserId })
            {
                var roles = await keycloak.GetUserRealmRolesAsync(client, id);
                if (roles.Any(RoleNames.Staff.Contains))
                    return Results.BadRequest(new { message = "A staff account cannot be merged." });
            }
            if (into["enabled"]?.GetValue<bool>() == false)
                return Results.BadRequest(new { message = "The account to keep is disabled; enable it first." });

            // The kept account takes the other's phone when it has none: the till finds people by it
            var fromPhone = Phone(from);
            var movePhone = fromPhone is not null && Phone(into) is null;

            from["enabled"] = false;
            if (movePhone && from["attributes"] is JsonObject fromAttributes) fromAttributes.Remove("phoneNumber");
            var switchedOff = await keycloak.PutUserAsync(client, userId, from);
            if (!switchedOff.IsSuccessStatusCode)
                return Results.Problem($"The account could not be switched off: {await switchedOff.Content.ReadAsStringAsync()}", statusCode: (int)switchedOff.StatusCode);
            await keycloak.LogoutUserAsync(client, userId);

            if (movePhone)
            {
                var attributes = into["attributes"] as JsonObject ?? [];
                attributes["phoneNumber"] = new JsonArray(fromPhone);
                into["attributes"] = attributes;
                var phoned = await keycloak.PutUserAsync(client, intoUserId, into);
                // The merge stands without it: the phone can be typed onto the kept account by hand
                if (!phoned.IsSuccessStatusCode)
                    logger.LogWarning("Merged {From} into {Into}, but the phone did not move: {Status}", userId, intoUserId, (int)phoned.StatusCode);
                else
                    await eventBus.PublishAsync(UserProfileUpdatedIntegrationEvent.From(intoUserId, into));
            }

            var name = PersonName.Display((string?)into["firstName"], (string?)into["lastName"]);
            await eventBus.PublishAsync(new CustomersMergedIntegrationEvent(userId, intoUserId, name));
            directory.ScheduleRefresh();
            logger.LogInformation("Customer {From} merged into {Into} by {Actor}", userId, intoUserId, http.User.GetUserId());
            return Results.Ok(new { mergedInto = intoUserId, phoneMoved = movePhone });
        }).RequireAuthorization("Owner");
    }

    private static string? Phone(JsonObject user)
    {
        var phone = (string?)((user["attributes"] as JsonObject)?["phoneNumber"] as JsonArray)?.FirstOrDefault();
        return string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
    }
}
