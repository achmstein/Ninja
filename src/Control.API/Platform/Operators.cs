using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;

namespace Ninja.Control.API.Platform;

/// <summary>One of the people who run the platform: a user of the ninja realm holding PlatformAdmin.</summary>
/// <param name="HasAuthenticator">An authenticator app is set up; false until the first sign-in finishes.</param>
/// <param name="PendingSetup">Keycloak still asks them for something on their next sign-in (a new password, an authenticator).</param>
public sealed record PlatformOperator(string Id, string Email, string? FirstName, string? LastName, bool Enabled, DateTimeOffset? CreatedAt, bool HasAuthenticator, bool PendingSetup);

/// <summary>
/// The platform realm's people: listed, invited with a temporary password,
/// shut out and let back in, and helped when a password or a phone is lost.
/// A person's own password and authenticator are theirs to change, through
/// Keycloak's own pages; nothing here reads or sets a password they chose.
/// </summary>
public interface IOperatorDirectory
{
    Task<IReadOnlyList<PlatformOperator>> ListAsync(CancellationToken ct);
    Task<PlatformOperator?> FindAsync(string id, CancellationToken ct);
    /// <summary>A new operator who sets a password and an authenticator on first sign-in; null when the email is taken.</summary>
    Task<string?> InviteAsync(string email, string? firstName, string? lastName, string temporaryPassword, CancellationToken ct);
    /// <summary>Disabling also ends every session they have.</summary>
    Task SetEnabledAsync(string id, bool enabled, CancellationToken ct);
    /// <summary>A temporary password to change on the next sign-in; their sessions end.</summary>
    Task ResetPasswordAsync(string id, string temporaryPassword, CancellationToken ct);
    /// <summary>The authenticator app forgotten and asked for again on the next sign-in; their sessions end.</summary>
    Task ResetAuthenticatorAsync(string id, CancellationToken ct);
    Task SignOutAsync(string id, CancellationToken ct);
}

/// <summary>The ninja realm through Keycloak's admin REST API, as the master realm's admin.</summary>
public sealed class KeycloakOperatorDirectory(KeycloakAdminToken admin) : IOperatorDirectory
{
    public const string Realm = "ninja";
    public const string Role = "PlatformAdmin";

    private string Users => $"{admin.Base}/admin/realms/{Realm}/users";

    public async Task<IReadOnlyList<PlatformOperator>> ListAsync(CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        // The role's members, not the realm's users: a user without the role cannot use the control app anyway
        var members = await client.GetFromJsonAsync<JsonArray>($"{admin.Base}/admin/realms/{Realm}/roles/{Role}/users?first=0&max=500&briefRepresentation=false", ct) ?? [];
        var operators = new List<PlatformOperator>();
        foreach (var user in members.OfType<JsonObject>())
            operators.Add(await ReadAsync(client, user, ct));
        return operators.OrderBy(o => o.Email, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<PlatformOperator?> FindAsync(string id, CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        using var response = await client.GetAsync($"{Users}/{Uri.EscapeDataString(id)}", ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        await ThrowIfRefusedAsync(response, "the operator", ct);
        var user = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!;
        // Someone else in the realm (a user whose role was taken away) is not an operator to manage
        var roles = await client.GetFromJsonAsync<JsonArray>($"{Users}/{Uri.EscapeDataString(id)}/role-mappings/realm/composite", ct) ?? [];
        if (!roles.Any(r => r?["name"]?.GetValue<string>() == Role)) return null;
        return await ReadAsync(client, user, ct);
    }

    public async Task<string?> InviteAsync(string email, string? firstName, string? lastName, string temporaryPassword, CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        var body = new JsonObject
        {
            ["username"] = email,
            ["email"] = email,
            ["firstName"] = firstName,
            ["lastName"] = lastName,
            ["enabled"] = true,
            // Handed over by a colleague who knows them; there is no mailbox check to make
            ["emailVerified"] = true,
            ["requiredActions"] = new JsonArray("UPDATE_PASSWORD", "CONFIGURE_TOTP"),
            ["credentials"] = new JsonArray(new JsonObject { ["type"] = "password", ["value"] = temporaryPassword, ["temporary"] = true }),
        };
        using var created = await client.PostAsJsonAsync(Users, body, ct);
        if (created.StatusCode == HttpStatusCode.Conflict) return null;
        await ThrowIfRefusedAsync(created, "the operator", ct);
        var id = created.Headers.Location!.Segments[^1];

        var role = await client.GetFromJsonAsync<JsonObject>($"{admin.Base}/admin/realms/{Realm}/roles/{Role}", ct);
        using var mapped = await client.PostAsJsonAsync($"{Users}/{id}/role-mappings/realm", new JsonArray(new JsonObject { ["id"] = role!["id"]!.GetValue<string>(), ["name"] = Role }), ct);
        await ThrowIfRefusedAsync(mapped, "the operator's role", ct);
        return id;
    }

    public async Task SetEnabledAsync(string id, bool enabled, CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        using var response = await client.PutAsJsonAsync($"{Users}/{Uri.EscapeDataString(id)}", new JsonObject { ["enabled"] = enabled }, ct);
        await ThrowIfRefusedAsync(response, "the operator", ct);
        // A disabled user's token stays good until it expires; the sessions behind it go now
        if (!enabled) await LogoutAsync(client, id, ct);
    }

    public async Task ResetPasswordAsync(string id, string temporaryPassword, CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        using var response = await client.PutAsJsonAsync($"{Users}/{Uri.EscapeDataString(id)}/reset-password",
            new JsonObject { ["type"] = "password", ["value"] = temporaryPassword, ["temporary"] = true }, ct);
        await ThrowIfRefusedAsync(response, "the password", ct);
        await LogoutAsync(client, id, ct);
    }

    public async Task ResetAuthenticatorAsync(string id, CancellationToken ct)
    {
        var client = await admin.ClientAsync(ct);
        var credentials = await client.GetFromJsonAsync<JsonArray>($"{Users}/{Uri.EscapeDataString(id)}/credentials", ct) ?? [];
        foreach (var otp in credentials.Where(c => c?["type"]?.GetValue<string>() == "otp"))
        {
            using var removed = await client.DeleteAsync($"{Users}/{Uri.EscapeDataString(id)}/credentials/{otp!["id"]!.GetValue<string>()}", ct);
            await ThrowIfRefusedAsync(removed, "the authenticator", ct);
        }

        // Asked for explicitly: the realm's default action only lands on users created after it was switched on
        var user = (await client.GetFromJsonAsync<JsonObject>($"{Users}/{Uri.EscapeDataString(id)}", ct))!;
        var actions = (user["requiredActions"] as JsonArray)?.Select(a => a!.GetValue<string>()).ToList() ?? [];
        if (!actions.Contains("CONFIGURE_TOTP"))
        {
            actions.Add("CONFIGURE_TOTP");
            using var updated = await client.PutAsJsonAsync($"{Users}/{Uri.EscapeDataString(id)}", new JsonObject { ["requiredActions"] = new JsonArray(actions.Select(a => (JsonNode)a).ToArray()) }, ct);
            await ThrowIfRefusedAsync(updated, "the operator", ct);
        }
        await LogoutAsync(client, id, ct);
    }

    public async Task SignOutAsync(string id, CancellationToken ct)
        => await LogoutAsync(await admin.ClientAsync(ct), id, ct);

    private async Task LogoutAsync(HttpClient client, string id, CancellationToken ct)
    {
        using var response = await client.PostAsync($"{Users}/{Uri.EscapeDataString(id)}/logout", null, ct);
        await ThrowIfRefusedAsync(response, "the sign-out", ct);
    }

    private async Task<PlatformOperator> ReadAsync(HttpClient client, JsonObject user, CancellationToken ct)
    {
        var id = user["id"]!.GetValue<string>();
        var credentials = await client.GetFromJsonAsync<JsonArray>($"{Users}/{id}/credentials", ct) ?? [];
        var created = user["createdTimestamp"]?.GetValue<long>();
        return new PlatformOperator(
            id,
            user["email"]?.GetValue<string>() ?? user["username"]!.GetValue<string>(),
            user["firstName"]?.GetValue<string>(),
            user["lastName"]?.GetValue<string>(),
            user["enabled"]?.GetValue<bool>() ?? false,
            created is { } ms ? DateTimeOffset.FromUnixTimeMilliseconds(ms) : null,
            credentials.Any(c => c?["type"]?.GetValue<string>() == "otp"),
            user["requiredActions"] is JsonArray { Count: > 0 });
    }

    private static async Task ThrowIfRefusedAsync(HttpResponseMessage response, string what, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        throw new InvalidOperationException($"Keycloak refused {what} ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
    }
}

/// <summary>Tests: operators in memory, starting with the one the test scheme signs in as.</summary>
public sealed class DryRunOperatorDirectory(ILogger<DryRunOperatorDirectory> logger) : IOperatorDirectory
{
    private readonly Lock _gate = new();
    private readonly Dictionary<string, PlatformOperator> _operators = [];

    /// <summary>Everyone the directory has signed out, in order.</summary>
    public List<string> SignedOut { get; } = [];

    /// <summary>An operator who is already there (the signed-in one, in a test).</summary>
    public void Seed(PlatformOperator op) { lock (_gate) _operators[op.Id] = op; }

    public Task<IReadOnlyList<PlatformOperator>> ListAsync(CancellationToken ct)
    {
        lock (_gate) return Task.FromResult<IReadOnlyList<PlatformOperator>>(_operators.Values.OrderBy(o => o.Email, StringComparer.OrdinalIgnoreCase).ToList());
    }

    public Task<PlatformOperator?> FindAsync(string id, CancellationToken ct)
    {
        lock (_gate) return Task.FromResult(_operators.GetValueOrDefault(id));
    }

    public Task<string?> InviteAsync(string email, string? firstName, string? lastName, string temporaryPassword, CancellationToken ct)
    {
        lock (_gate)
        {
            if (_operators.Values.Any(o => string.Equals(o.Email, email, StringComparison.OrdinalIgnoreCase))) return Task.FromResult<string?>(null);
            var id = Guid.NewGuid().ToString();
            _operators[id] = new PlatformOperator(id, email, firstName, lastName, true, DateTimeOffset.UtcNow, false, true);
            logger.LogInformation("(dry run) operator {Email} invited", email);
            return Task.FromResult<string?>(id);
        }
    }

    public Task SetEnabledAsync(string id, bool enabled, CancellationToken ct)
    {
        lock (_gate)
        {
            _operators[id] = _operators[id] with { Enabled = enabled };
            if (!enabled) SignedOut.Add(id);
        }
        return Task.CompletedTask;
    }

    public Task ResetPasswordAsync(string id, string temporaryPassword, CancellationToken ct)
    {
        lock (_gate)
        {
            _operators[id] = _operators[id] with { PendingSetup = true };
            SignedOut.Add(id);
        }
        return Task.CompletedTask;
    }

    public Task ResetAuthenticatorAsync(string id, CancellationToken ct)
    {
        lock (_gate)
        {
            _operators[id] = _operators[id] with { HasAuthenticator = false, PendingSetup = true };
            SignedOut.Add(id);
        }
        return Task.CompletedTask;
    }

    public Task SignOutAsync(string id, CancellationToken ct)
    {
        lock (_gate) SignedOut.Add(id);
        return Task.CompletedTask;
    }
}

/// <summary>
/// The platform realm is imported once and never stamped, so what the
/// template gained since is put on at start: Keycloak's account pages (the
/// control app's "Authenticator &amp; sessions") given a token that says who
/// is asking. Retried each minute until Keycloak answers, then done.
/// </summary>
public sealed class PlatformRealmService(KeycloakRestAdmin keycloak, ILogger<PlatformRealmService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                await keycloak.EnsureAccountConsoleAsync(KeycloakOperatorDirectory.Realm, stoppingToken);
                logger.LogInformation("Account console ensured in the {Realm} realm", KeycloakOperatorDirectory.Realm);
                return;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Could not ensure the account console in the {Realm} realm; trying again in a minute", KeycloakOperatorDirectory.Realm);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
