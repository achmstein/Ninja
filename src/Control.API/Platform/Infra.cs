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
    /// <summary>A service's durable queue off the vhost, with whatever it holds; nothing when there is none (the module was never on, or is gone twice).</summary>
    Task DeleteQueueAsync(string vhost, string queue, CancellationToken ct);
}

public interface IKeycloakAdmin
{
    Task<bool> RealmExistsAsync(string realm, CancellationToken ct);
    Task CreateRealmAsync(string realmJson, CancellationToken ct);
    Task DeleteRealmAsync(string realm, CancellationToken ct);
    /// <summary>Creates the user with the roles and a temporary password, or leaves an existing one alone. Returns the user id.</summary>
    Task<string> EnsureUserAsync(string realm, string email, string firstName, string password, IReadOnlyList<string> realmRoles, CancellationToken ct);
    Task<string?> FindUserIdAsync(string realm, string email, CancellationToken ct);
    /// <summary>Whether the user still carries the required action (UPDATE_PASSWORD until the first password is changed); false for a user who is not there.</summary>
    Task<bool> HasRequiredActionAsync(string realm, string email, string action, CancellationToken ct);
    /// <summary>The realm's SMTP settings (Keycloak's smtpServer map, as JSON), so it can send its own password resets.</summary>
    Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct);
    /// <summary>
    /// The owner's assistant in a realm that was created before there was one:
    /// the mcp client scope with its audience and role mappings, the realm's
    /// default scopes, the ninja-mcp and assistant-api clients and the anonymous
    /// registration policies, all as the realm template declares them. Idempotent;
    /// a realm created from the current template gets nothing new.
    /// </summary>
    Task EnsureAssistantClientsAsync(string realm, string apiUrl, string assistantSecret, CancellationToken ct);
    /// <summary>
    /// The platform's shared Google and Apple providers in a tenant's realm,
    /// so the native apps can exchange a provider token for one of the realm's
    /// own. Idempotent, and a no-op while the platform holds no social app.
    /// </summary>
    Task EnsureSocialProvidersAsync(string realm, CancellationToken ct);
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
            Port = options.Value.PostgresPort,
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
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
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

    public Task DeleteQueueAsync(string vhost, string queue, CancellationToken ct)
        => CtlAsync(["delete_queue", "-p", vhost, queue], ct, tolerate: true);

    /// <summary>rabbitmqctl in the broker's container; <paramref name="tolerate"/> lets "already gone" pass on a delete.</summary>
    private async Task<string> CtlAsync(string[] args, CancellationToken ct, bool tolerate = false)
    {
        var result = await shell.RunAsync("docker", ["exec", Container, "rabbitmqctl", .. args], null, ct);
        if (result.Ok) return result.Output;
        // "already gone" as the CLI has phrased it over the years: {:not_found, …}, no_such_user, RabbitMQ 4's "Virtual host 'x' does not exist"
        // and delete_queue's "No such queue was found"
        if (tolerate && (result.Output.Contains("not_found", StringComparison.OrdinalIgnoreCase) || result.Output.Contains("no_such", StringComparison.OrdinalIgnoreCase)
                         || result.Output.Contains("does not exist", StringComparison.OrdinalIgnoreCase) || result.Output.Contains("not found", StringComparison.OrdinalIgnoreCase)
                         || result.Output.Contains("no such", StringComparison.OrdinalIgnoreCase)))
            return result.Output;
        throw new InvalidOperationException($"rabbitmqctl {args[0]} failed: {result.Output}");
    }
}

/// <summary>
/// The master realm admin's token, fetched once and kept until shortly before
/// it expires, not on every call (a stamp makes a dozen). Shared by everything
/// that speaks Keycloak's admin REST API.
/// </summary>
public sealed class KeycloakAdminToken(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options)
{
    private static readonly TimeSpan Margin = TimeSpan.FromSeconds(30);

    private readonly SemaphoreSlim _tokenGate = new(1, 1);
    private (string Token, DateTimeOffset ExpiresAt)? _token;

    public string Base => options.Value.KeycloakInternalUrl.TrimEnd('/');

    /// <summary>A client carrying the admin token.</summary>
    public async Task<HttpClient> ClientAsync(CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("keycloak");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await TokenAsync(ct));
        return client;
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        if (_token is { } cached && cached.ExpiresAt - Margin > DateTimeOffset.UtcNow) return cached.Token;
        await _tokenGate.WaitAsync(ct);
        try
        {
            if (_token is { } again && again.ExpiresAt - Margin > DateTimeOffset.UtcNow) return again.Token;
            var client = httpClientFactory.CreateClient("keycloak");
            var response = await client.PostAsync($"{Base}/realms/master/protocol/openid-connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "password",
                ["client_id"] = "admin-cli",
                ["username"] = options.Value.KeycloakAdminUser,
                ["password"] = options.Value.KeycloakAdminPassword,
            }), ct);
            response.EnsureSuccessStatusCode();
            var body = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!;
            var token = body["access_token"]!.GetValue<string>();
            var expiresIn = body["expires_in"]?.GetValue<int>() ?? 60;
            _token = (token, DateTimeOffset.UtcNow.AddSeconds(expiresIn));
            return token;
        }
        finally
        {
            _tokenGate.Release();
        }
    }
}

/// <summary>Keycloak's admin REST API as the master realm's admin: realms in and out, the first owner in.</summary>
public sealed class KeycloakRestAdmin(KeycloakAdminToken admin, IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options) : IKeycloakAdmin
{
    /// <summary>With a token of its own, for a caller outside the container.</summary>
    public KeycloakRestAdmin(IHttpClientFactory httpClientFactory, IOptions<PlatformOptions> options)
        : this(new KeycloakAdminToken(httpClientFactory, options), httpClientFactory, options) { }

    private string Base => admin.Base;

    private Task<HttpClient> AdminClientAsync(CancellationToken ct) => admin.ClientAsync(ct);

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

    public async Task<bool> HasRequiredActionAsync(string realm, string email, string action, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var users = await client.GetFromJsonAsync<JsonArray>($"{Base}/admin/realms/{realm}/users?email={Uri.EscapeDataString(email)}&exact=true", ct);
        if (users is not { Count: > 0 }) return false;
        return users[0]!["requiredActions"] is JsonArray actions && actions.Any(a => a?.GetValue<string>() == action);
    }

    public async Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct)
    {
        var client = await AdminClientAsync(ct);
        var body = new JsonObject { ["smtpServer"] = JsonNode.Parse(smtpServerJson) };
        var response = await client.PutAsJsonAsync($"{Base}/admin/realms/{realm}", body, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Keycloak refused the SMTP settings for {realm} ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
    }

    public async Task EnsureAssistantClientsAsync(string realm, string apiUrl, string assistantSecret, CancellationToken ct)
    {
        var parts = Templates.AssistantRealmParts(apiUrl, assistantSecret);
        var client = await AdminClientAsync(ct);
        var admin = $"{Base}/admin/realms/{realm}";

        // The mcp client scope, and its audience mapper kept on the current API host
        var scopes = await client.GetFromJsonAsync<JsonArray>($"{admin}/client-scopes", ct) ?? [];
        string? ScopeId(string name) => scopes.FirstOrDefault(s => s?["name"]?.GetValue<string>() == name)?["id"]?.GetValue<string>();
        var mcpId = ScopeId("mcp");
        if (mcpId is null)
        {
            var created = await client.PostAsJsonAsync($"{admin}/client-scopes", parts.McpScope, ct);
            await ThrowIfRefusedAsync(created, $"the mcp client scope in {realm}", ct);
            mcpId = created.Headers.Location!.Segments[^1];
        }
        else
        {
            // Each mapper by name: the endpoint audience follows the API host, the exchange-client one stays
            var mappers = await client.GetFromJsonAsync<JsonArray>($"{admin}/client-scopes/{mcpId}/protocol-mappers/models", ct) ?? [];
            foreach (var wanted in parts.McpScope["protocolMappers"]!.AsArray().Select(m => (JsonObject)m!.DeepClone()))
            {
                var name = wanted["name"]!.GetValue<string>();
                var existing = mappers.FirstOrDefault(m => m?["name"]?.GetValue<string>() == name) as JsonObject;
                if (existing is null)
                {
                    await ThrowIfRefusedAsync(await client.PostAsJsonAsync($"{admin}/client-scopes/{mcpId}/protocol-mappers/models", wanted, ct), $"mapper '{name}' in {realm}", ct);
                }
                else
                {
                    wanted["id"] = existing["id"]!.GetValue<string>();
                    await ThrowIfRefusedAsync(await client.PutAsJsonAsync($"{admin}/client-scopes/{mcpId}/protocol-mappers/models/{wanted["id"]}", wanted, ct), $"mapper '{name}' in {realm}", ct);
                }
            }
        }

        // Realm defaults for clients that register themselves (ChatGPT, Claude): the template's lists
        foreach (var name in parts.DefaultScopes)
        {
            var id = ScopeId(name) ?? (name == "mcp" ? mcpId : null);
            if (id is null) continue;
            await ThrowIfRefusedAsync(await client.PutAsync($"{admin}/default-default-client-scopes/{id}", null, ct), $"default scope {name} in {realm}", ct);
        }
        foreach (var name in parts.OptionalScopes)
        {
            if (ScopeId(name) is not { } id) continue;
            await ThrowIfRefusedAsync(await client.PutAsync($"{admin}/default-optional-client-scopes/{id}", null, ct), $"optional scope {name} in {realm}", ct);
        }

        // The realm roles the mcp scope hands a client that may not see every role
        var roles = new JsonArray();
        foreach (var role in parts.McpRoles)
        {
            using var lookup = await client.GetAsync($"{admin}/roles/{role}", ct);
            if (!lookup.IsSuccessStatusCode) continue;
            var rep = await lookup.Content.ReadFromJsonAsync<JsonObject>(ct);
            if (rep is not null) roles.Add(new JsonObject { ["id"] = rep["id"]!.GetValue<string>(), ["name"] = role });
        }
        if (roles.Count > 0)
            await ThrowIfRefusedAsync(await client.PostAsJsonAsync($"{admin}/client-scopes/{mcpId}/scope-mappings/realm", roles, ct), $"the mcp role mappings in {realm}", ct);

        // The two clients: created, or brought up to the template (redirect URIs, scopes, the secret on the record)
        foreach (var wanted in parts.Clients.Select(c => (JsonObject)c!.DeepClone()))
        {
            var clientId = wanted["clientId"]!.GetValue<string>();
            var found = await client.GetFromJsonAsync<JsonArray>($"{admin}/clients?clientId={Uri.EscapeDataString(clientId)}", ct) ?? [];
            if (found.Count == 0)
            {
                await ThrowIfRefusedAsync(await client.PostAsJsonAsync($"{admin}/clients", wanted, ct), $"client {clientId} in {realm}", ct);
            }
            else
            {
                var id = found[0]!["id"]!.GetValue<string>();
                wanted["id"] = id;
                await ThrowIfRefusedAsync(await client.PutAsJsonAsync($"{admin}/clients/{id}", wanted, ct), $"client {clientId} in {realm}", ct);
            }
        }

        // The anonymous registration policies: trusted hosts and allowed scopes for the clients that register themselves
        var realmRep = await client.GetFromJsonAsync<JsonObject>(admin, ct);
        var realmId = realmRep!["id"]!.GetValue<string>();
        var components = await client.GetFromJsonAsync<JsonArray>($"{admin}/components?type={Uri.EscapeDataString(Templates.ClientRegistrationPolicyType)}", ct) ?? [];
        foreach (var wanted in parts.Policies.Select(p => (JsonObject)p!.DeepClone()))
        {
            var providerId = wanted["providerId"]!.GetValue<string>();
            var subType = wanted["subType"]!.GetValue<string>();
            var existing = components.FirstOrDefault(c => c?["providerId"]?.GetValue<string>() == providerId && c?["subType"]?.GetValue<string>() == subType) as JsonObject;
            wanted["parentId"] = realmId;
            wanted["providerType"] = Templates.ClientRegistrationPolicyType;
            wanted.Remove("subComponents"); // import-only; the admin API rejects it on a component
            if (existing is null)
            {
                await ThrowIfRefusedAsync(await client.PostAsJsonAsync($"{admin}/components", wanted, ct), $"registration policy {providerId} in {realm}", ct);
            }
            else
            {
                wanted["id"] = existing["id"]!.GetValue<string>();
                await ThrowIfRefusedAsync(await client.PutAsJsonAsync($"{admin}/components/{wanted["id"]}", wanted, ct), $"registration policy {providerId} in {realm}", ct);
            }
        }
    }

    public async Task EnsureSocialProvidersAsync(string realm, CancellationToken ct)
    {
        var wanted = Templates.SocialProviders(options.Value);
        if (wanted.Count == 0) return;

        var client = await AdminClientAsync(ct);
        var admin = $"{Base}/admin/realms/{realm}";
        var existing = await client.GetFromJsonAsync<JsonArray>($"{admin}/identity-provider/instances", ct) ?? [];

        foreach (var provider in wanted.Select(p => (JsonObject)p!.DeepClone()))
        {
            var alias = provider["alias"]!.GetValue<string>();
            var found = existing.FirstOrDefault(p => p?["alias"]?.GetValue<string>() == alias) as JsonObject;
            if (found is null)
            {
                await ThrowIfRefusedAsync(await client.PostAsJsonAsync($"{admin}/identity-provider/instances", provider, ct), $"the {alias} identity provider in {realm}", ct);
            }
            else
            {
                // A rotated secret (Apple's expires) lands on the realm that already has the provider
                provider["internalId"] = found["internalId"]?.GetValue<string>();
                await ThrowIfRefusedAsync(await client.PutAsJsonAsync($"{admin}/identity-provider/instances/{alias}", provider, ct), $"the {alias} identity provider in {realm}", ct);
            }
        }
    }

    private static async Task ThrowIfRefusedAsync(HttpResponseMessage response, string what, CancellationToken ct)
    {
        using (response)
        {
            if (response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.Conflict) return;
            throw new InvalidOperationException($"Keycloak refused {what} ({(int)response.StatusCode}): {await response.Content.ReadAsStringAsync(ct)}");
        }
    }

    public async Task<IReadOnlyList<string>> ImpersonateAsync(string realm, string userId, string publicAuthHost, CancellationToken ct)
    {
        // Keycloak (KC_PROXY_HEADERS=xforwarded) mints the cookies for the host and scheme the browser will use, not for the
        // internal name. It also checks the admin token's issuer against that same host, so the token for this one call is
        // minted through the same forwarded headers (the cached one was issued for the internal name and would be refused).
        var client = httpClientFactory.CreateClient("keycloak");
        using var grant = new HttpRequestMessage(HttpMethod.Post, $"{Base}/realms/master/protocol/openid-connect/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "password",
                ["client_id"] = "admin-cli",
                ["username"] = options.Value.KeycloakAdminUser,
                ["password"] = options.Value.KeycloakAdminPassword,
            }),
        };
        grant.Headers.Add("X-Forwarded-Proto", "https");
        grant.Headers.Add("X-Forwarded-Host", publicAuthHost);
        using var granted = await client.SendAsync(grant, ct);
        granted.EnsureSuccessStatusCode();
        var token = (await granted.Content.ReadFromJsonAsync<JsonObject>(ct))!["access_token"]!.GetValue<string>();

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{Base}/admin/realms/{realm}/users/{userId}/impersonation");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
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
        // The services the plan stamps; a module's service that is not there has no probe to answer
        var pending = PlanCatalog.Services(tenant).ToHashSet();
        while (pending.Count > 0)
        {
            foreach (var service in pending.ToArray())
            {
                try
                {
                    using var response = await proxy.SendAsync(tenant, HttpMethod.Get, $"/health/{service}", null, StackAuth.Anonymous, ct);
                    if (response.IsSuccessStatusCode) pending.Remove(service);
                }
                // Not up yet: refused, dropped, or hanging past the client's timeout (which surfaces as a cancellation that is not ours)
                catch (Exception ex) when (ex is HttpRequestException || (ex is OperationCanceledException or TimeoutException && !ct.IsCancellationRequested)) { }
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
    public Task<bool> HasRequiredActionAsync(string realm, string email, string action, CancellationToken ct) => Task.FromResult(true);
    public Task SetRealmSmtpAsync(string realm, string smtpServerJson, CancellationToken ct) { logger.LogInformation("(dry run) smtp on {Realm}", realm); return Task.CompletedTask; }
    public Task EnsureAssistantClientsAsync(string realm, string apiUrl, string assistantSecret, CancellationToken ct)
    {
        // The template must still yield the parts, so a broken realm file fails a dry run too
        var parts = Templates.AssistantRealmParts(apiUrl, assistantSecret);
        logger.LogInformation("(dry run) assistant in {Realm}: mcp scope, {Clients} clients, {Policies} policies", realm, parts.Clients.Count, parts.Policies.Count);
        return Task.CompletedTask;
    }
    public Task EnsureSocialProvidersAsync(string realm, CancellationToken ct)
    {
        logger.LogInformation("(dry run) social providers in {Realm}", realm);
        return Task.CompletedTask;
    }
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
