using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Ninja.Control.NodeRuntime;

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

/// <summary>As the superuser: roles and databases in and out, and the hand-over of a database created before its tenant had a role of its own.</summary>
public sealed partial class NpgsqlDatabaseAdmin(IOptions<NodeSettings> options) : IDatabaseAdmin
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

/// <summary>RabbitMQ has no management API in the image the platform runs, so it is rabbitmqctl in the broker's container.</summary>
public sealed class RabbitCtlBrokerAdmin(IShell shell, IOptions<NodeSettings> options) : IBrokerAdmin
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

public sealed class DryRunDatabaseAdmin(ILogger<DryRunDatabaseAdmin> logger) : IDatabaseAdmin
{
    public List<string> Created { get; } = [];
    public List<string> Roles { get; } = [];
    public List<string> Dropped { get; } = [];
    public Task EnsureRoleAsync(string role, string password, CancellationToken ct) { if (!Roles.Contains(role)) Roles.Add(role); logger.LogInformation("(dry run) role {Role}", role); return Task.CompletedTask; }
    public Task EnsureDatabaseAsync(string name, string owner, CancellationToken ct) { if (!Created.Contains(name)) Created.Add(name); logger.LogInformation("(dry run) database {Db} owned by {Owner}", name, owner); return Task.CompletedTask; }
    public Task DropDatabaseAsync(string name, CancellationToken ct) { Created.Remove(name); Dropped.Add(name); logger.LogInformation("(dry run) drop database {Db}", name); return Task.CompletedTask; }
    public Task DropRoleAsync(string role, CancellationToken ct) { Roles.Remove(role); logger.LogInformation("(dry run) drop role {Role}", role); return Task.CompletedTask; }
    public Task LockDownAsync(string name, CancellationToken ct) { logger.LogInformation("(dry run) revoke public on {Db}", name); return Task.CompletedTask; }
}

/// <summary>Dry run: the user and the vhost exist as soon as they are asked for.</summary>
public sealed class DryRunBrokerAdmin(ILogger<DryRunBrokerAdmin> logger) : IBrokerAdmin
{
    public List<string> Users { get; } = [];
    public Task EnsureUserAsync(string user, string password, CancellationToken ct) { if (!Users.Contains(user)) Users.Add(user); logger.LogInformation("(dry run) broker user {User}", user); return Task.CompletedTask; }
    public Task EnsureVHostAsync(string vhost, string user, CancellationToken ct) { logger.LogInformation("(dry run) vhost {VHost} for {User}", vhost, user); return Task.CompletedTask; }
    public Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct) { logger.LogInformation("(dry run) {User} off vhost {VHost}", user, vhost); return Task.CompletedTask; }
    public Task DeleteVHostAsync(string vhost, CancellationToken ct) { logger.LogInformation("(dry run) delete vhost {VHost}", vhost); return Task.CompletedTask; }
    public Task DeleteUserAsync(string user, CancellationToken ct) { Users.Remove(user); logger.LogInformation("(dry run) delete broker user {User}", user); return Task.CompletedTask; }
    public List<string> DeletedQueues { get; } = [];
    public Task DeleteQueueAsync(string vhost, string queue, CancellationToken ct) { DeletedQueues.Add($"{vhost}/{queue}"); logger.LogInformation("(dry run) delete queue {Queue} on {VHost}", queue, vhost); return Task.CompletedTask; }
}
