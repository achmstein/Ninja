using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Npgsql;

namespace Ninja.Control.API.Platform;

// The four things a stack needs from the shared box, behind interfaces so a
// dry run can record instead of act. Every operation is idempotent: a retry
// after a failure runs the whole list again.

public interface IDatabaseAdmin
{
    /// <summary>A login role with this password, created or re-keyed: no superuser, no createdb, no createrole.</summary>
    Task EnsureRoleAsync(string role, string password, CancellationToken ct);
    /// <summary>The database owned by the role: created with it, or handed over (the database and everything inside it) when it already exists; closed to PUBLIC either way.</summary>
    Task EnsureDatabaseAsync(string name, string owner, CancellationToken ct);
    Task DropDatabaseAsync(string name, CancellationToken ct);
    /// <summary>The role, once its databases are gone.</summary>
    Task DropRoleAsync(string role, CancellationToken ct);
    /// <summary>Nobody but the owner and the superuser may connect.</summary>
    Task LockDownAsync(string name, CancellationToken ct);
}

public interface IBrokerAdmin
{
    /// <summary>A user with this password, created or re-keyed, with no management tags.</summary>
    Task EnsureUserAsync(string user, string password, CancellationToken ct);
    /// <summary>The vhost, with the user allowed everything on it and the dead-letter policy.</summary>
    Task EnsureVHostAsync(string vhost, string user, CancellationToken ct);
    /// <summary>The user loses the vhost (the shared user, once the stack is on its own).</summary>
    Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct);
    Task DeleteVHostAsync(string vhost, CancellationToken ct);
    Task DeleteUserAsync(string user, CancellationToken ct);
}

public interface IKeycloakAdmin
{
    Task<bool> RealmExistsAsync(string realm, CancellationToken ct);
    Task CreateRealmAsync(string realmJson, CancellationToken ct);
    Task DeleteRealmAsync(string realm, CancellationToken ct);
    /// <summary>Creates the user with the roles and a temporary password, or leaves an existing one alone. Returns the user id.</summary>
    Task<string> EnsureUserAsync(string realm, string email, string firstName, string password, IReadOnlyList<string> realmRoles, CancellationToken ct);
    Task<string?> FindUserIdAsync(string realm, string email, CancellationToken ct);
    /// <summary>The realm's SMTP settings (Keycloak's smtpServer map, as JSON), so it can send its own password resets.</summary>
    Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct);
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
    /// <summary>What the plan allows ({ reservations, timeBilling, loyalty, … }), as the control service account; the stack clamps its switches to it.</summary>
    Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct);
}

/// <summary>As the superuser: roles and databases in and out, and the hand-over of a database created before its tenant had a role of its own.</summary>
public sealed partial class NpgsqlDatabaseAdmin(IOptions<PlatformOptions> options) : IDatabaseAdmin
{
    private string Superuser => options.Value.PostgresUser;

    private async Task<NpgsqlConnection> OpenAsync(string database, CancellationToken ct)
    {
        var conn = new NpgsqlConnection(new NpgsqlConnectionStringBuilder
        {
            Host = options.Value.PostgresHost,
            Username = Superuser,
            Password = options.Value.PostgresPassword,
            Database = database,
            // The control plane's own connection: a failed hand-over should say which object
            IncludeErrorDetail = true,
        }.ConnectionString);
        await conn.OpenAsync(ct);
        return conn;
    }

    public async Task EnsureRoleAsync(string role, string password, CancellationToken ct)
    {
        Identifier(role);
        Secret(password);
        await using var conn = await OpenAsync("postgres", ct);
        var exists = await ScalarAsync(conn, "select 1 from pg_roles where rolname = @r", ("r", role), ct) is not null;
        // Neither an identifier nor a role's password can be a parameter; both are ours and checked above.
        // INHERIT matters: the public schema belongs to the database's owner through the implicit
        // pg_database_owner membership, which a NOINHERIT role could only reach with SET ROLE.
        await ExecAsync(conn, exists
            ? $"alter role \"{role}\" with login inherit password '{password}'"
            : $"create role \"{role}\" login inherit password '{password}' nosuperuser nocreatedb nocreaterole", ct);
    }

    public async Task EnsureDatabaseAsync(string name, string owner, CancellationToken ct)
    {
        Identifier(name);
        Identifier(owner);
        await using var conn = await OpenAsync("postgres", ct);
        var current = await ScalarAsync(conn, "select pg_get_userbyid(datdba) from pg_database where datname = @n", ("n", name), ct) as string;
        if (current is null)
        {
            await ExecAsync(conn, $"create database \"{name}\" owner \"{owner}\"", ct);
        }
        else
        {
            // Stamped before the tenant had a role: the database and, inside it,
            // every table the services migrated as the superuser go to the role.
            // Re-run on every stamp, so a hand-over that stopped halfway finishes.
            if (current != owner) await ExecAsync(conn, $"alter database \"{name}\" owner to \"{owner}\"", ct);
            await using var inside = await OpenAsync(name, ct);
            await ExecAsync(inside, HandOver(owner), ct);
        }
        await ExecAsync(conn, $"revoke all on database \"{name}\" from public", ct);
    }

    public async Task DropDatabaseAsync(string name, CancellationToken ct)
    {
        Identifier(name);
        await using var conn = await OpenAsync("postgres", ct);
        await ExecAsync(conn, $"drop database if exists \"{name}\" with (force)", ct);
    }

    public async Task DropRoleAsync(string role, CancellationToken ct)
    {
        Identifier(role);
        await using var conn = await OpenAsync("postgres", ct);
        await ExecAsync(conn, $"drop role if exists \"{role}\"", ct);
    }

    public async Task LockDownAsync(string name, CancellationToken ct)
    {
        Identifier(name);
        await using var conn = await OpenAsync("postgres", ct);
        await ExecAsync(conn, $"revoke all on database \"{name}\" from public", ct);
    }

    /// <summary>
    /// Everything the superuser owns in the current database goes to the
    /// role: tables (their indexes and identity sequences follow), views,
    /// sequences, functions, enums and schemas. REASSIGN OWNED BY is not an
    /// option: Postgres refuses it for the bootstrap superuser.
    /// </summary>
    private string HandOver(string owner) => $$"""
        do $$
        declare r record;
        begin
          for r in
            select n.nspname, c.relname, c.relkind
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%'
              and c.relkind in ('r', 'p', 'v', 'm', 'f')
              and pg_get_userbyid(c.relowner) = '{{Superuser}}'
          loop
            execute format('alter %s %I.%I owner to %I',
              case r.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'f' then 'foreign table' else 'table' end,
              r.nspname, r.relname, '{{owner}}');
          end loop;
          -- A serial or identity sequence must keep its table's owner and has moved with it above; only a free-standing one is altered
          for r in
            select n.nspname, c.relname
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%'
              and c.relkind = 'S' and pg_get_userbyid(c.relowner) = '{{Superuser}}'
              and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i'))
          loop
            execute format('alter sequence %I.%I owner to %I', r.nspname, r.relname, '{{owner}}');
          end loop;
          for r in
            select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prokind
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%'
              and pg_get_userbyid(p.proowner) = '{{Superuser}}'
          loop
            execute format('alter %s %I.%I(%s) owner to %I',
              case r.prokind when 'p' then 'procedure' else 'function' end, r.nspname, r.proname, r.args, '{{owner}}');
          end loop;
          for r in
            select n.nspname, t.typname
            from pg_type t join pg_namespace n on n.oid = t.typnamespace
            where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%'
              and t.typtype in ('e', 'd') and pg_get_userbyid(t.typowner) = '{{Superuser}}'
          loop
            execute format('alter type %I.%I owner to %I', r.nspname, r.typname, '{{owner}}');
          end loop;
          for r in
            select nspname from pg_namespace
            where nspname not in ('pg_catalog', 'information_schema') and nspname not like 'pg\_%'
              and pg_get_userbyid(nspowner) = '{{Superuser}}'
          loop
            execute format('alter schema %I owner to %I', r.nspname, '{{owner}}');
          end loop;
        end $$;
        """;

    private static async Task<object?> ScalarAsync(NpgsqlConnection conn, string sql, (string Name, string Value) parameter, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(sql, conn);
        command.Parameters.AddWithValue(parameter.Name, parameter.Value);
        return await command.ExecuteScalarAsync(ct);
    }

    private static async Task ExecAsync(NpgsqlConnection conn, string sql, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(sql, conn);
        await command.ExecuteNonQueryAsync(ct);
    }

    /// <summary>A database or role name: slug-derived (lower-case, digits, dashes) plus the platform's own suffixes, the only thing that ever reaches an identifier position.</summary>
    private static void Identifier(string name)
    {
        if (!IdentifierPattern().IsMatch(name)) throw new ArgumentException($"'{name}' is not a name this platform makes.", nameof(name));
    }

    /// <summary>A password as TenantNaming.NewSecret makes them: nothing that could close the quote it sits in.</summary>
    private static void Secret(string password)
    {
        if (!SecretPattern().IsMatch(password)) throw new ArgumentException("The password is not one of ours.", nameof(password));
    }

    [GeneratedRegex("^[a-z0-9_-]{1,63}$")]
    private static partial Regex IdentifierPattern();

    [GeneratedRegex("^[A-Za-z0-9_-]{16,64}$")]
    private static partial Regex SecretPattern();
}

/// <summary>Once, at start: the platform's own databases and the maintenance one stop accepting anyone but the superuser, which is what keeps every tenant role out of them.</summary>
public sealed class PlatformLockdownService(IDatabaseAdmin databases, ILogger<PlatformLockdownService> logger) : BackgroundService
{
    public static readonly string[] Databases = ["controldb", "keycloak", "postgres"];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var db in Databases)
        {
            try
            {
                await databases.LockDownAsync(db, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Could not close {Db} to PUBLIC", db);
            }
        }
    }
}

/// <summary>RabbitMQ has no management API in the image the platform runs, so it is rabbitmqctl in the broker's container.</summary>
public sealed class RabbitCtlBrokerAdmin(IShell shell, IOptions<PlatformOptions> options) : IBrokerAdmin
{
    private string Container => options.Value.RabbitContainer;

    public async Task EnsureUserAsync(string user, string password, CancellationToken ct)
    {
        // One user per line, then a tab and its tags
        var list = await CtlAsync(["list_users", "--quiet", "--no-table-headers"], ct);
        var known = list.Split('\n').Select(l => l.Split('\t')[0].Trim()).Contains(user);
        await CtlAsync(known ? ["change_password", user, password] : ["add_user", user, password], ct);
        // No tags: the management UI is not for a stack
        await CtlAsync(["set_user_tags", user], ct);
    }

    public async Task EnsureVHostAsync(string vhost, string user, CancellationToken ct)
    {
        var list = await CtlAsync(["list_vhosts", "--quiet", "--no-table-headers"], ct);
        if (!list.Split('\n').Select(l => l.Trim()).Contains(vhost))
            await CtlAsync(["add_vhost", vhost], ct);
        await CtlAsync(["set_permissions", "-p", vhost, user, ".*", ".*", ".*"], ct);
        // Same dead-letter policy the single stack has, per vhost
        await CtlAsync(["set_policy", "-p", vhost, "dead-letter", ".*", "{\"dead-letter-exchange\":\"ninja_dead_letters\"}", "--apply-to", "queues"], ct);
    }

    public Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct)
        => CtlAsync(["clear_permissions", "-p", vhost, user], ct, tolerate: true);

    public Task DeleteVHostAsync(string vhost, CancellationToken ct)
        => CtlAsync(["delete_vhost", vhost], ct, tolerate: true);

    public Task DeleteUserAsync(string user, CancellationToken ct)
        => CtlAsync(["delete_user", user], ct, tolerate: true);

    /// <summary>rabbitmqctl in the broker's container; <paramref name="tolerate"/> lets "already gone" pass on a delete.</summary>
    private async Task<string> CtlAsync(string[] args, CancellationToken ct, bool tolerate = false)
    {
        var result = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", .. args], null, ct);
        if (result.Ok) return result.Output;
        if (tolerate && (result.Output.Contains("not_found", StringComparison.OrdinalIgnoreCase) || result.Output.Contains("no_such", StringComparison.OrdinalIgnoreCase)))
            return result.Output;
        throw new InvalidOperationException($"rabbitmqctl {args[0]} failed: {result.Output}");
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

    public async Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var body = new JsonObject { ["smtpServer"] = JsonNode.Parse(smtpServerJson) };
        var response = await client.PutAsJsonAsync($"{Base}/admin/realms/{realm}", body, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak refused the SMTP settings for {realm} ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
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

    public async Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct)
    {
        using var put = await proxy.SendAsync(tenant, HttpMethod.Put, "/api/tenant/entitlements", JsonContent.Create(entitled), StackAuth.Control, ct);
        if (!put.IsSuccessStatusCode)
            throw new InvalidOperationException($"The stack refused the entitlements ({(int)put.StatusCode}): {await put.Content.ReadAsStringAsync(ct)}");
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
    public List<string> Roles { get; } = [];
    public Task EnsureRoleAsync(string role, string password, CancellationToken ct) { if (!Roles.Contains(role)) Roles.Add(role); logger.LogInformation("(dry run) role {Role}", role); return Task.CompletedTask; }
    public Task EnsureDatabaseAsync(string name, string owner, CancellationToken ct) { if (!Created.Contains(name)) Created.Add(name); logger.LogInformation("(dry run) database {Db} owned by {Owner}", name, owner); return Task.CompletedTask; }
    public Task DropDatabaseAsync(string name, CancellationToken ct) { Created.Remove(name); logger.LogInformation("(dry run) drop database {Db}", name); return Task.CompletedTask; }
    public Task DropRoleAsync(string role, CancellationToken ct) { Roles.Remove(role); logger.LogInformation("(dry run) drop role {Role}", role); return Task.CompletedTask; }
    public Task LockDownAsync(string name, CancellationToken ct) { logger.LogInformation("(dry run) revoke public on {Db}", name); return Task.CompletedTask; }
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
    public Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct) { logger.LogInformation("(dry run) smtp on {Realm}", realm); return Task.CompletedTask; }
    public Task<IReadOnlyList<string>> ImpersonateAsync(string realm, string userId, string publicAuthHost, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<string>>([$"KEYCLOAK_IDENTITY=dry-run; Path=/realms/{realm}/; Secure; HttpOnly; SameSite=None"]);
}

public sealed class DryRunTenantStack(DryRunStackProxy proxy, ILogger<DryRunTenantStack> logger) : ITenantStack
{
    public Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct) { logger.LogInformation("(dry run) {Gateway} healthy", TenantNaming.Gateway(tenant.Slug)); return Task.CompletedTask; }
    public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(proxy.BrandOf(tenant));
    public async Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct)
    {
        using var response = await proxy.SendAsync(tenant, HttpMethod.Put, "/api/tenant/entitlements", JsonContent.Create(entitled), StackAuth.Control, ct);
        logger.LogInformation("(dry run) entitlements for {Slug}: {Entitled}", tenant.Slug, entitled.ToJsonString());
    }
    public async Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct)
    {
        // Through the same double the control app reads, so what was seeded is what it shows
        using var response = await proxy.SendAsync(tenant, HttpMethod.Put, "/api/tenant", JsonContent.Create(brand), StackAuth.Control, ct);
        logger.LogInformation("(dry run) brand seeded for {Slug} with {Count} image(s): {Brand}", tenant.Slug, images.Count, brand.ToJsonString());
    }
}
