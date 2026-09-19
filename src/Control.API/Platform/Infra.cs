using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
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
}

public interface ITenantStack
{
    /// <summary>Waits until the stack's gateway answers for every service, or gives up.</summary>
    Task WaitHealthyAsync(string gateway, TimeSpan timeout, CancellationToken ct);
    /// <summary>Puts the brand through the stack's own API, as the control service account.</summary>
    Task SeedBrandAsync(string gateway, string realm, string controlSecret, JsonObject brand, string? logoPath, CancellationToken ct);
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
}

/// <summary>Talks to a freshly stamped stack through its gateway on the shared network.</summary>
public sealed class HttpTenantStack(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options, ILogger<HttpTenantStack> logger) : ITenantStack
{
    public async Task WaitHealthyAsync(string gateway, TimeSpan timeout, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("stack");
        var deadline = DateTimeOffset.UtcNow + timeout;
        var pending = TenantNaming.Services.ToHashSet();
        while (pending.Count > 0)
        {
            foreach (var service in pending.ToArray())
            {
                try
                {
                    var response = await client.GetAsync($"http://{gateway}:5000/health/{service}", ct);
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

    public async Task SeedBrandAsync(string gateway, string realm, string controlSecret, JsonObject brand, string? logoPath, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("stack");
        var tokenResponse = await client.PostAsync($"{options.Value.KeycloakInternalUrl.TrimEnd('/')}/realms/{realm}/protocol/openid-connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = "ninja-control",
            ["client_secret"] = controlSecret,
        }), ct);
        tokenResponse.EnsureSuccessStatusCode();
        var token = (await tokenResponse.Content.ReadFromJsonAsync<JsonObject>(ct))!["access_token"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var put = await client.PutAsJsonAsync($"http://{gateway}:5000/api/tenant", brand, ct);
        if (!put.IsSuccessStatusCode)
            throw new InvalidOperationException($"The stack refused the brand ({(int)put.StatusCode}): {await put.Content.ReadAsStringAsync(ct)}");

        if (logoPath is not null && File.Exists(logoPath))
        {
            using var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(await File.ReadAllBytesAsync(logoPath, ct));
            file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(file, "file", "logo.png");
            var logo = await client.PutAsync($"http://{gateway}:5000/api/tenant/logo", form, ct);
            if (!logo.IsSuccessStatusCode)
                throw new InvalidOperationException($"The stack refused the logo ({(int)logo.StatusCode}): {await logo.Content.ReadAsStringAsync(ct)}");
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
}

public sealed class DryRunTenantStack(ILogger<DryRunTenantStack> logger) : ITenantStack
{
    public List<JsonObject> Brands { get; } = [];
    public Task WaitHealthyAsync(string gateway, TimeSpan timeout, CancellationToken ct) { logger.LogInformation("(dry run) {Gateway} healthy", gateway); return Task.CompletedTask; }
    public Task SeedBrandAsync(string gateway, string realm, string controlSecret, JsonObject brand, string? logoPath, CancellationToken ct)
    {
        Brands.Add(brand);
        logger.LogInformation("(dry run) brand seeded through {Gateway}: {Brand}", gateway, brand.ToJsonString());
        return Task.CompletedTask;
    }
}
