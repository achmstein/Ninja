using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ninja.Identity.FunctionalTests;

/// <summary>
/// Keycloak, as much of it as Identity.API talks to: a service-account
/// token, the admin REST calls that make, read and write a user, the realm
/// roles and who holds them. It runs in the test process on a loopback
/// port, holds its users in memory, and is what the scenarios read to see
/// what Identity actually wrote — the payload Keycloak would have stored.
/// </summary>
public sealed class FakeKeycloak : IAsyncDisposable
{
    public const string Realm = "ninja";

    private static readonly string[] RealmRoles = ["Admin", "Cashier", "Owner"];

    private readonly WebApplication _app;
    private readonly ConcurrentDictionary<string, JsonObject> _users = new();
    private readonly ConcurrentDictionary<string, List<string>> _rolesOf = new();

    private FakeKeycloak(WebApplication app) => _app = app;

    /// <summary>What Identity.API is given as <c>Identity:Url</c>.</summary>
    public string RealmUrl { get; private set; } = "";

    /// <summary>Turn the service account off, as a Keycloak that will not answer.</summary>
    public bool TokenWorks { get; set; } = true;

    public static async Task<FakeKeycloak> StartAsync()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseSetting("urls", "http://127.0.0.1:0");

        var app = builder.Build();
        var fake = new FakeKeycloak(app);
        fake.Map(app);

        await app.StartAsync();
        fake.RealmUrl = $"{app.Urls.First()}/realms/{Realm}";
        return fake;
    }

    /// <summary>Someone already in Keycloak before the scenario starts.</summary>
    public string Given(string email, string first, string last, string? phone = null, string? role = null, IEnumerable<int>? branches = null)
    {
        var id = Guid.NewGuid().ToString();
        var attributes = new JsonObject();
        if (phone is not null) attributes["phoneNumber"] = new JsonArray(phone);
        if (branches is not null) attributes["branches"] = new JsonArray(branches.Select(b => (JsonNode)b.ToString()).ToArray());

        _users[id] = new JsonObject
        {
            ["id"] = id,
            ["username"] = email,
            ["email"] = email,
            ["firstName"] = first,
            ["lastName"] = last,
            ["enabled"] = true,
            ["emailVerified"] = true,
            ["attributes"] = attributes,
        };
        if (role is not null) _rolesOf[id] = [role];
        return id;
    }

    /// <summary>The user as Keycloak now holds them, or null when nothing was written.</summary>
    public JsonObject? User(string id) => _users.GetValueOrDefault(id);

    public JsonObject? UserByEmail(string email)
        => _users.Values.FirstOrDefault(u => string.Equals(u["email"]?.GetValue<string>(), email, StringComparison.OrdinalIgnoreCase));

    public IReadOnlyList<string> RolesOf(string id) => _rolesOf.GetValueOrDefault(id) ?? [];

    /// <summary>The passwords set through the admin API, newest last, per user.</summary>
    public ConcurrentDictionary<string, List<string>> PasswordsSet { get; } = new();

    public async ValueTask DisposeAsync()
    {
        await _app.StopAsync();
        await _app.DisposeAsync();
    }

    private void Map(WebApplication app)
    {
        var admin = $"/admin/realms/{Realm}";

        app.MapPost($"/realms/{Realm}/protocol/openid-connect/token", () => TokenWorks
            ? Results.Ok(new { access_token = "a-service-account-token", expires_in = 60 })
            : Results.Unauthorized());

        app.MapPost($"{admin}/users", (JsonObject user) =>
        {
            var email = user["email"]?.GetValue<string>() ?? "";
            if (UserByEmail(email) is not null)
            {
                return Results.Conflict(new { errorMessage = "User exists with same email" });
            }

            var id = Guid.NewGuid().ToString();
            Remember(id, user);
            user["id"] = id;
            _users[id] = user;
            return Results.Created($"{admin}/users/{id}", null);
        });

        app.MapGet($"{admin}/users", (int? first, int? max) => Results.Ok(_users.Values
            .OrderBy(u => u["username"]?.GetValue<string>(), StringComparer.OrdinalIgnoreCase)
            .Skip(first ?? 0)
            .Take(max ?? 100)
            .Select(Copy)
            .ToList()));

        app.MapGet($"{admin}/users/{{id}}", (string id) => _users.TryGetValue(id, out var user)
            ? Results.Ok(Copy(user))
            : Results.NotFound());

        app.MapPut($"{admin}/users/{{id}}", (string id, JsonObject user) =>
        {
            if (!_users.ContainsKey(id)) return Results.NotFound();
            user["id"] = id;
            _users[id] = user;
            return Results.NoContent();
        });

        app.MapPut($"{admin}/users/{{id}}/reset-password", (string id, JsonObject credential) =>
        {
            if (!_users.ContainsKey(id)) return Results.NotFound();
            PasswordsSet.GetOrAdd(id, _ => []).Add(credential["value"]?.GetValue<string>() ?? "");
            return Results.NoContent();
        });

        app.MapDelete($"{admin}/users/{{id}}", (string id) => _users.TryRemove(id, out _) ? Results.NoContent() : Results.NotFound());

        app.MapPost($"{admin}/users/{{id}}/logout", (string id) => Results.NoContent());

        app.MapGet($"{admin}/roles", () => Results.Ok(RealmRoles.Select(r => new { id = r.ToLowerInvariant(), name = r }).ToList()));

        app.MapGet($"{admin}/roles/{{name}}", (string name) => RealmRoles.Contains(name)
            ? Results.Ok(new { id = name.ToLowerInvariant(), name })
            : Results.NotFound());

        app.MapGet($"{admin}/roles/{{name}}/users", (string name, int? first, int? max) => Results.Ok(_users.Values
            .Where(u => RolesOf(u["id"]!.GetValue<string>()).Contains(name))
            .OrderBy(u => u["username"]?.GetValue<string>(), StringComparer.OrdinalIgnoreCase)
            .Skip(first ?? 0)
            .Take(max ?? 100)
            .Select(Copy)
            .ToList()));

        app.MapPost($"{admin}/users/{{id}}/role-mappings/realm", (string id, JsonArray roles) =>
        {
            _rolesOf[id] = roles.Select(r => r?["name"]?.GetValue<string>() ?? "").Where(n => n.Length > 0).ToList();
            return Results.NoContent();
        });
    }

    /// <summary>A password sent with the user's own creation is set all the same.</summary>
    private void Remember(string id, JsonObject user)
    {
        if (user["credentials"] is JsonArray credentials && credentials.FirstOrDefault()?["value"]?.GetValue<string>() is { } password)
        {
            PasswordsSet.GetOrAdd(id, _ => []).Add(password);
        }
    }

    /// <summary>Keycloak answers with its own copy; a scenario must not be able to edit ours through it.</summary>
    private static JsonObject Copy(JsonObject user) => (JsonObject)user.DeepClone();
}
