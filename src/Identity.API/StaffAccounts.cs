using System.Text.Json.Nodes;
using Ninja.EventBus.Abstractions;
using Ninja.Identity.API.IntegrationEvents;
using Ninja.ServiceDefaults;

namespace Ninja.Identity.API;

/// <summary>What became of a request for a new staff account.</summary>
public abstract record StaffCreation
{
    public sealed record Created(string UserId) : StaffCreation;

    public sealed record Taken : StaffCreation;

    /// <param name="Status">The HTTP status the caller answers with.</param>
    public sealed record Failed(string Message, int Status) : StaffCreation;
}

/// <summary>
/// Staff accounts on Keycloak, made whole or not at all, and said to the rest
/// of the stack whenever one changes (<see cref="StaffAccountChangedIntegrationEvent"/>).
/// </summary>
public sealed class StaffAccounts(KeycloakAdmin keycloak, IEventBus eventBus, ILogger<StaffAccounts> logger)
{
    /// <summary>
    /// A login for a member of staff, with its role (and Owner) and branches.
    /// The roles are looked up before anything is made, so a realm that lacks
    /// one refuses up front; and if the roles cannot be given once the user
    /// exists, the user is deleted again: a working login with no role, whose
    /// email then blocks the retry, is never left behind.
    /// </summary>
    public async Task<StaffCreation> CreateAsync(
        string email, string password, string? name, string role, bool isOwner, IReadOnlyList<int> branchIds, CancellationToken ct = default)
    {
        HttpClient client;
        try
        {
            client = await keycloak.AuthorizedClientAsync();
        }
        catch (InvalidOperationException ex)
        {
            return new StaffCreation.Failed(ex.Message, 500);
        }

        var wanted = isOwner ? new[] { role, RoleNames.Owner } : new[] { role };
        var mappings = new List<JsonObject>();
        foreach (var roleName in wanted)
        {
            if (await keycloak.GetRealmRoleAsync(client, roleName) is not { } found)
            {
                logger.LogError("Staff account refused: the realm has no {Role} role; it needs bringing up to date", roleName);
                return new StaffCreation.Failed($"{roleName} role not found in realm.", 500);
            }
            mappings.Add(found);
        }

        // Staff are added with one name, split at its first space
        var (firstName, lastName) = PersonName.Of(null, null, name);
        var created = await keycloak.CreateUserAsync(client, new
        {
            username = email,
            email,
            firstName,
            lastName,
            enabled = true,
            emailVerified = true,
            requiredActions = Array.Empty<string>(),
            // Branch membership lives on the user (see PUT users/{id}/branches)
            attributes = new Dictionary<string, string[]> { ["branches"] = branchIds.Select(id => id.ToString()).ToArray() },
            credentials = new[] { new { type = "password", value = password, temporary = false } },
        });

        if (created.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            return new StaffCreation.Taken();
        }
        if (!created.IsSuccessStatusCode)
        {
            return new StaffCreation.Failed($"Registration failed: {await created.Content.ReadAsStringAsync(ct)}", (int)created.StatusCode);
        }

        var userId = created.Headers.Location?.ToString().Split('/').LastOrDefault()
            ?? await keycloak.FindUserIdByEmailAsync(client, email);
        if (string.IsNullOrEmpty(userId))
        {
            return new StaffCreation.Failed("User created but its id could not be read back", 500);
        }

        HttpResponseMessage assigned;
        try
        {
            assigned = await keycloak.AssignRealmRolesAsync(client, userId, mappings);
        }
        catch (HttpRequestException ex)
        {
            assigned = new HttpResponseMessage(System.Net.HttpStatusCode.BadGateway) { ReasonPhrase = ex.Message };
        }
        if (!assigned.IsSuccessStatusCode)
        {
            var why = assigned.Content is null ? assigned.ReasonPhrase : await assigned.Content.ReadAsStringAsync(ct);
            await UndoAsync(client, userId);
            return new StaffCreation.Failed($"The staff account was not made: its role could not be given ({why})", 500);
        }

        var display = PersonName.Display(firstName, lastName);
        await SayAsync(new StaffAccountChangedIntegrationEvent(userId, display, wanted, branchIds.ToArray(), true));
        return new StaffCreation.Created(userId);
    }

    private async Task UndoAsync(HttpClient client, string userId)
    {
        try
        {
            var deleted = await keycloak.DeleteUserAsync(client, userId);
            if (!deleted.IsSuccessStatusCode)
                logger.LogError("A staff account without its role could not be deleted ({Status}); delete user {UserId} by hand", deleted.StatusCode, userId);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "A staff account without its role could not be deleted; delete user {UserId} by hand", userId);
        }
    }

    /// <summary>
    /// Say a staff account as it now stands, read back from Keycloak: after its
    /// branches, its name or its enabled state changed. A user with no staff
    /// role is said only when it was switched off, so a former rider's phone
    /// stops ringing; customers are otherwise nobody's business here.
    /// </summary>
    public async Task AnnounceAsync(string userId, CancellationToken ct = default)
    {
        try
        {
            var client = await keycloak.AuthorizedClientAsync();
            var user = await keycloak.GetUserAsync(client, userId);
            if (user is null)
            {
                await AnnounceGoneAsync(userId);
                return;
            }

            var roles = (await keycloak.GetUserRealmRolesAsync(client, userId))
                .Where(r => RoleNames.Staff.Contains(r, StringComparer.OrdinalIgnoreCase)).ToArray();
            var enabled = user["enabled"]?.GetValue<bool>() ?? false;
            if (roles.Length == 0 && enabled) return;

            var attributes = user["attributes"] as JsonObject;
            var branches = (attributes?["branches"] as JsonArray ?? [])
                .Select(b => int.TryParse(b?.ToString(), out var id) ? id : 0).Where(id => id > 0).Distinct().Order().ToArray();
            var name = PersonName.Display(user["firstName"]?.GetValue<string>(), user["lastName"]?.GetValue<string>());
            await SayAsync(new StaffAccountChangedIntegrationEvent(userId, name, roles, branches, enabled));
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException)
        {
            // The account changed; only the telling failed. The next start says every staff account again.
            logger.LogWarning(ex, "Could not say staff account {UserId} changed", userId);
        }
    }

    /// <summary>The account is gone: no roles, switched off.</summary>
    public Task AnnounceGoneAsync(string userId) =>
        SayAsync(new StaffAccountChangedIntegrationEvent(userId, "", [], [], false));

    private async Task SayAsync(StaffAccountChangedIntegrationEvent @event)
    {
        try
        {
            await eventBus.PublishAsync(@event);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not say staff account {UserId} changed", @event.UserId);
        }
    }
}
