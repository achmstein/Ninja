using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Npgsql;

namespace Ninja.Control.API.Platform;

// The four things a stack needs from the shared box, behind interfaces so a
// dry run can record instead of act. Every operation is idempotent: a retry
// after a failure runs the whole list again.

public interface IDatabaseAdmin
{
    Task EnsureDatabaseAsync(string name, CancellationToken ct);
    Task DropDatabaseAsync(string name, CancellationToken ct);
}

public interface IBrokerAdmin
{
    Task EnsureVHostAsync(string vhost, string user, CancellationToken ct);
    Task DeleteVHostAsync(string vhost, CancellationToken ct);
}

public interface IKeycloakAdmin
{
    Task<bool> RealmExistsAsync(string realm, CancellationToken ct);
    Task CreateRealmAsync(string realmJson, CancellationToken ct);
    Task DeleteRealmAsync(string realm, CancellationToken ct);
    /// <summary>Creates the user with the roles and a temporary password, or leaves an existing one alone. Returns the user id.</summary>
    Task<string> EnsureUserAsync(string realm, string email, string firstName, string password, IReadOnlyList<string> realmRoles, CancellationToken ct);
    Task<string?> FindUserIdAsync(string realm, string email, CancellationToken ct);
    /// <summary>
    /// Signs the user in without their password, as the master admin may: a
    /// browser session in their realm, returned as the Set-Cookie headers a
    /// browser on <paramref name="publicAuthHost"/> would have received.
    /// </summary>
    Task<IReadOnlyList<string>> ImpersonateAsync(string realm, string userId, string publicAuthHost, CancellationToken ct);
}

public interface ITenantStack
{
    /// <summary>Waits until the stack's gateway answers for every service, or gives up.</summary>
    Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct);
    /// <summary>Puts the brand and the seed images (slot → file) through the stack's own API, as the control service account.</summary>
    Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct);
    /// <summary>The brand as the stack serves it now (a restore keeps what the dump brought).</summary>
    Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct);
}

public sealed class NpgsqlDatabaseAdmin(IOptions<PlatformOptions> options) : IDatabaseAdmin
{
    private string ConnectionString => new NpgsqlConnectionStringBuilder
    {
        Host = options.Value.PostgresHost,
        Username = options.Value.PostgresUser,
        Password = options.Value.PostgresPassword,
        Database = "postgres",
    }.ConnectionString;

    public async Task EnsureDatabaseAsync(string name, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync(ct);
        await using var exists = new NpgsqlCommand("select 1 from pg_database where datname = @n", conn);
        exists.Parameters.AddWithValue("n", name);
        if (await exists.ExecuteScalarAsync(ct) is not null) return;
        // Identifiers cannot be parameters; the name is slug_dbname, both validated
        await using var create = new NpgsqlCommand($"create database \"{name}\"", conn);
        await create.ExecuteNonQueryAsync(ct);
    }

    public async Task DropDatabaseAsync(string name, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync(ct);
        await using var drop = new NpgsqlCommand($"drop database if exists \"{name}\" with (force)", conn);
        await drop.ExecuteNonQueryAsync(ct);
    }
}

/// <summary>RabbitMQ has no management API in the image the platform runs, so it is rabbitmqctl in the broker's container.</summary>
public sealed class RabbitCtlBrokerAdmin(IShell shell, IOptions<PlatformOptions> options) : IBrokerAdmin
{
    private string Container => options.Value.RabbitContainer;

    public async Task EnsureVHostAsync(string vhost, string user, CancellationToken ct)
    {
        var list = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", "list_vhosts", "--quiet", "--no-table-headers"], null, ct);
        if (!list.Ok) throw new InvalidOperationException($"rabbitmqctl list_vhosts failed: {list.Output}");
        if (!list.Output.Split('\n').Select(l => l.Trim()).Contains(vhost))
        {
            var add = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", "add_vhost", vhost], null, ct);
            if (!add.Ok) throw new InvalidOperationException($"rabbitmqctl add_vhost failed: {add.Output}");
        }
        var perms = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", "set_permissions", "-p", vhost, user, ".*", ".*", ".*"], null, ct);
        if (!perms.Ok) throw new InvalidOperationException($"rabbitmqctl set_permissions failed: {perms.Output}");
        // Same dead-letter policy the single stack has, per vhost
        var policy = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", "set_policy", "-p", vhost, "dead-letter", ".*", "{\"dead-letter-exchange\":\"ninja_dead_letters\"}", "--apply-to", "queues"], null, ct);
        if (!policy.Ok) throw new InvalidOperationException($"rabbitmqctl set_policy failed: {policy.Output}");
    }

    public async Task DeleteVHostAsync(string vhost, CancellationToken ct)
    {
        var result = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", "delete_vhost", vhost], null, ct);
        if (!result.Ok && !result.Output.Contains("not_found", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"rabbitmqctl delete_vhost failed: {result.Output}");
    }
}

/// <summary>Keycloak's admin REST API as the master realm's admin: realms in and out, the first owner in.</summary>
public sealed class KeycloakRestAdmin(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options) : IKeycloakAdmin
{
    private string Base => options.Value.KeycloakInternalUrl.TrimEnd('/');

    private async Task<HttpClient> AdminClientAsync(CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("keycloak");
        var response = await client.PostAsync($"{Base}/realms/master/protocol/openid-connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "admin-cli",
            ["username"] = options.Value.KeycloakAdminUser,
            ["password"] = options.Value.KeycloakAdminPassword,
        }), ct);
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!["access_token"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<bool> RealmExistsAsync(string realm, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var response = await client.GetAsync($"{Base}/admin/realms/{realm}", ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return false;
        response.EnsureSuccessStatusCode();
        return true;
    }

    public async Task CreateRealmAsync(string realmJson, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var response = await client.PostAsync($"{Base}/admin/realms", new StringContent(realmJson, System.Text.Encoding.UTF8, "application/json"), ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak refused the realm ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
    }

    public async Task DeleteRealmAsync(string realm, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var response = await client.DeleteAsync($"{Base}/admin/realms/{realm}", ct);
        if (response.StatusCode != HttpStatusCode.NotFound) response.EnsureSuccessStatusCode();
    }

    public async Task<string> EnsureUserAsync(string realm, string email, string firstName, string password, IReadOnlyList<string> realmRoles, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var users = $"{Base}/admin/realms/{realm}/users";

        var existing = await client.GetFromJsonAsync<JsonArray>($"{users}?email={Uri.EscapeDataString(email)}&exact=true", ct);
        string id;
        if (existing is { Count: > 0 })
        {
            id = existing[0]!["id"]!.GetValue<string>();
        }
        else
        {
            var body = new JsonObject
            {
                ["username"] = email,
                ["email"] = email,
                ["firstName"] = firstName,
                ["enabled"] = true,
                ["emailVerified"] = true,
                ["requiredActions"] = new JsonArray("UPDATE_PASSWORD"),
                ["credentials"] = new JsonArray(new JsonObject { ["type"] = "password", ["value"] = password, ["temporary"] = true }),
            };
            var created = await client.PostAsJsonAsync(users, body, ct);
            if (!created.IsSuccessStatusCode)
                throw new InvalidOperationException($"Keycloak refused the owner ({(int)created.StatusCode}): {await created.Content.ReadAsStringAsync(ct)}");
            id = created.Headers.Location!.Segments[^1];
        }

        var roles = new JsonArray();
        foreach (var role in realmRoles)
        {
            var rep = await client.GetFromJsonAsync<JsonObject>($"{Base}/admin/realms/{realm}/roles/{role}", ct);
            roles.Add(new JsonObject { ["id"] = rep!["id"]!.GetValue<string>(), ["name"] = role });
        }
        var mapped = await client.PostAsJsonAsync($"{users}/{id}/role-mappings/realm", roles, ct);
        mapped.EnsureSuccessStatusCode();
        return id;
    }

    public async Task<string?> FindUserIdAsync(string realm, string email, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var users = await client.GetFromJsonAsync<JsonArray>($"{Base}/admin/realms/{realm}/users?email={Uri.EscapeDataString(email)}&exact=true", ct);
        return users is { Count: > 0 } ? users[0]!["id"]!.GetValue<string>() : null;
    }

    public async Task<IReadOnlyList<string>> ImpersonateAsync(string realm, string userId, string publicAuthHost, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{Base}/admin/realms/{realm}/users/{userId}/impersonation");
        // Keycloak (KC_PROXY_HEADERS=xforwarded) mints the cookies for the host and scheme the browser will use, not for the internal name
        request.Headers.Add("X-Forwarded-Proto", "https");
        request.Headers.Add("X-Forwarded-Host", publicAuthHost);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak refused the impersonation ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
        return response.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies.ToList() : [];
    }
}

/// <summary>Talks to a freshly stamped stack through its gateway on the shared network.</summary>
public sealed class HttpTenantStack(IStackProxy proxy, ILogger<HttpTenantStack> logger) : ITenantStack
{
    public async Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;
        var pending = TenantNaming.Services.ToHashSet();
        while (pending.Count > 0)
        {
            foreach (var service in pending.ToArray())
            {
                try
                {
                    using var response = await proxy.SendAsync(tenant, HttpMethod.Get, $"/health/{service}", null, StackAuth.Anonymous, ct);
                    if (response.IsSuccessStatusCode) pending.Remove(service);
                }
                catch (HttpRequestException) { }
            }
            if (pending.Count == 0) break;
            if (DateTimeOffset.UtcNow > deadline)
                throw new TimeoutException($"Still not healthy after {timeout}: {string.Join(", ", pending)}");
            logger.LogInformation("Waiting for {Count} services: {Pending}", pending.Count, string.Join(", ", pending));
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    public async Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct)
    {
        using var response = await proxy.SendAsync(tenant, HttpMethod.Get, "/api/tenant", null, StackAuth.Anonymous, ct);
        return response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<JsonObject>(ct) : null;
    }

    public async Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct)
    {
        using var put = await proxy.SendAsync(tenant, HttpMethod.Put, "/api/tenant", JsonContent.Create(brand), StackAuth.Control, ct);
        if (!put.IsSuccessStatusCode)
            throw new InvalidOperationException($"The stack refused the brand ({(int)put.StatusCode}): {await put.Content.ReadAsStringAsync(ct)}");

        foreach (var (slot, path) in images)
        {
            using var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(await File.ReadAllBytesAsync(path, ct));
            file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(file, "file", $"{slot}.png");
            using var upload = await proxy.SendAsync(tenant, HttpMethod.Put, $"/api/tenant/images/{slot}", form, StackAuth.Control, ct);
            if (!upload.IsSuccessStatusCode)
                throw new InvalidOperationException($"The stack refused the {slot} ({(int)upload.StatusCode}): {await upload.Content.ReadAsStringAsync(ct)}");
        }
    }
}

// ---------- dry run: records, answers yes ----------

public sealed class DryRunDatabaseAdmin(ILogger<DryRunDatabaseAdmin> logger) : IDatabaseAdmin
{
    public List<string> Created { get; } = [];
    public Task EnsureDatabaseAsync(string name, CancellationToken ct) { Created.Add(name); logger.LogInformation("(dry run) create database {Db}", name); return Task.CompletedTask; }
    public Task DropDatabaseAsync(string name, CancellationToken ct) { Created.Remove(name); logger.LogInformation("(dry run) drop database {Db}", name); return Task.CompletedTask; }
}

public sealed class DryRunKeycloakAdmin(ILogger<DryRunKeycloakAdmin> logger) : IKeycloakAdmin
{
    public Dictionary<string, string> Realms { get; } = [];
    public Task<bool> RealmExistsAsync(string realm, CancellationToken ct) => Task.FromResult(Realms.ContainsKey(realm));
    public Task CreateRealmAsync(string realmJson, CancellationToken ct)
    {
        var realm = JsonNode.Parse(realmJson)!["realm"]!.GetValue<string>();
        Realms[realm] = realmJson;
        logger.LogInformation("(dry run) create realm {Realm} ({Bytes} bytes)", realm, realmJson.Length);
        return Task.CompletedTask;
    }
    public Task DeleteRealmAsync(string realm, CancellationToken ct) { Realms.Remove(realm); return Task.CompletedTask; }
    public Task<string> EnsureUserAsync(string realm, string email, string firstName, string password, IReadOnlyList<string> realmRoles, CancellationToken ct)
    {
        logger.LogInformation("(dry run) owner {Email} in {Realm} with {Roles}", email, realm, string.Join(",", realmRoles));
        return Task.FromResult(Guid.NewGuid().ToString());
    }
    public Task<string?> FindUserIdAsync(string realm, string email, CancellationToken ct) => Task.FromResult<string?>($"dry-run-{email}");
    public Task<IReadOnlyList<string>> ImpersonateAsync(string realm, string userId, string publicAuthHost, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<string>>([$"KEYCLOAK_IDENTITY=dry-run; Path=/realms/{realm}/; Secure; HttpOnly; SameSite=None"]);
}

public sealed class DryRunTenantStack(DryRunStackProxy proxy, ILogger<DryRunTenantStack> logger) : ITenantStack
{
    public Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct) { logger.LogInformation("(dry run) {Gateway} healthy", TenantNaming.Gateway(tenant.Slug)); return Task.CompletedTask; }
    public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(proxy.BrandOf(tenant));
    public async Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct)
    {
        // Through the same double the control app reads, so what was seeded is what it shows
        using var response = await proxy.SendAsync(tenant, HttpMethod.Put, "/api/tenant", JsonContent.Create(brand), StackAuth.Control, ct);
        logger.LogInformation("(dry run) brand seeded for {Slug} with {Count} image(s): {Brand}", tenant.Slug, images.Count, brand.ToJsonString());
    }
}
