using Ninja.Control.API.Platform;
using Npgsql;

namespace Ninja.Control.IntegrationTests;

/// <summary>The superuser's work on the shared Postgres: a role that owns its databases and nothing else, and the hand-over of one made before the role existed.</summary>
[TestClass]
public sealed class PostgresAdminTests
{
    private static NpgsqlDatabaseAdmin Admin() => new(Containers.Options);

    private static string ConnectionString(string database, string user, string password)
        => new NpgsqlConnectionStringBuilder { Host = Containers.Platform.PostgresHost, Port = Containers.Platform.PostgresPort, Username = user, Password = password, Database = database, Pooling = false }.ConnectionString;

    private static async Task<object?> ScalarAsync(string connectionString, string sql)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        return await cmd.ExecuteScalarAsync();
    }

    private static async Task ExecAsync(string connectionString, string sql)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task A_tenant_role_owns_its_databases_can_migrate_in_them_and_cannot_reach_anothers()
    {
        var admin = Admin();
        var password = TenantNaming.NewSecret();

        await admin.EnsureRoleAsync("blue_app", password, CancellationToken.None);
        await admin.EnsureDatabaseAsync("blue_catalogdb", "blue_app", CancellationToken.None);
        await admin.EnsureRoleAsync("red_app", TenantNaming.NewSecret(), CancellationToken.None);
        await admin.EnsureDatabaseAsync("red_catalogdb", "red_app", CancellationToken.None);

        // The role is no superuser and creates nothing outside its databases
        var superuser = ConnectionString("postgres", "postgres", Containers.PostgresPassword);
        Assert.AreEqual(false, await ScalarAsync(superuser, "select rolsuper from pg_roles where rolname = 'blue_app'"));
        Assert.AreEqual(false, await ScalarAsync(superuser, "select rolcreatedb from pg_roles where rolname = 'blue_app'"));
        Assert.AreEqual("blue_app", await ScalarAsync(superuser, "select pg_get_userbyid(datdba) from pg_database where datname = 'blue_catalogdb'"));

        // As the role: a migration's worth of DDL in its own database
        var asBlue = ConnectionString("blue_catalogdb", "blue_app", password);
        await ExecAsync(asBlue, "create table items (id serial primary key, name text not null); insert into items (name) values ('latte')");
        Assert.AreEqual(1L, await ScalarAsync(asBlue, "select count(*) from items"));

        // And not a foot in another tenant's
        var asBlueInRed = ConnectionString("red_catalogdb", "blue_app", password);
        await Assert.ThrowsExactlyAsync<PostgresException>(() => ExecAsync(asBlueInRed, "select 1"), "PUBLIC has no CONNECT on a tenant database");

        // Re-keyed: the old password stops working, the new one works
        var rotated = TenantNaming.NewSecret();
        await admin.EnsureRoleAsync("blue_app", rotated, CancellationToken.None);
        await Assert.ThrowsExactlyAsync<PostgresException>(() => ExecAsync(asBlue, "select 1"));
        Assert.AreEqual(1L, await ScalarAsync(ConnectionString("blue_catalogdb", "blue_app", rotated), "select count(*) from items"));

        // Down: the databases, then the role
        await admin.DropDatabaseAsync("blue_catalogdb", CancellationToken.None);
        await admin.DropRoleAsync("blue_app", CancellationToken.None);
        Assert.IsNull(await ScalarAsync(superuser, "select 1 from pg_roles where rolname = 'blue_app'"));
        await admin.DropDatabaseAsync("red_catalogdb", CancellationToken.None);
        await admin.DropRoleAsync("red_app", CancellationToken.None);
    }

    [TestMethod]
    public async Task A_database_stamped_before_the_role_is_handed_over_with_everything_the_superuser_made_inside()
    {
        var admin = Admin();
        var superuser = ConnectionString("postgres", "postgres", Containers.PostgresPassword);

        // As the platform once did: the superuser creates the database and the services migrate as the superuser
        await ExecAsync(superuser, "create database green_salesdb");
        var inside = ConnectionString("green_salesdb", "postgres", Containers.PostgresPassword);
        await ExecAsync(inside, """
            create schema reports;
            create type ticket_state as enum ('open', 'settled');
            create table tickets (id bigint generated always as identity primary key, state ticket_state not null default 'open', total numeric(12,2));
            create sequence free_standing;
            create view open_tickets as select * from tickets where state = 'open';
            create function ticket_count() returns bigint language sql as 'select count(*) from tickets';
            insert into tickets (total) values (12.5), (7.25);
            """);

        var password = TenantNaming.NewSecret();
        await admin.EnsureRoleAsync("green_app", password, CancellationToken.None);
        await admin.EnsureDatabaseAsync("green_salesdb", "green_app", CancellationToken.None);

        // Everything now belongs to the role, and the role can do what a newer image's migration does
        Assert.AreEqual("green_app", await ScalarAsync(superuser, "select pg_get_userbyid(datdba) from pg_database where datname = 'green_salesdb'"));
        var owners = await ScalarAsync(inside, """
            select string_agg(distinct pg_get_userbyid(relowner), ',')
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('public', 'reports') and c.relkind in ('r', 'S', 'v')
            """);
        Assert.AreEqual("green_app", owners);
        Assert.AreEqual("green_app", await ScalarAsync(inside, "select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'reports'"));
        Assert.AreEqual("green_app", await ScalarAsync(inside, "select pg_get_userbyid(typowner) from pg_type where typname = 'ticket_state'"));
        Assert.AreEqual("green_app", await ScalarAsync(inside, "select pg_get_userbyid(proowner) from pg_proc where proname = 'ticket_count'"));

        var asGreen = ConnectionString("green_salesdb", "green_app", password);
        await ExecAsync(asGreen, "alter table tickets add column note text; alter type ticket_state add value 'void'; insert into tickets (total, note) values (1, 'x')");
        Assert.AreEqual(3L, await ScalarAsync(asGreen, "select ticket_count()"));

        // Run again, as every stamp does: nothing to hand over, nothing breaks
        await admin.EnsureDatabaseAsync("green_salesdb", "green_app", CancellationToken.None);

        await admin.DropDatabaseAsync("green_salesdb", CancellationToken.None);
        await admin.DropRoleAsync("green_app", CancellationToken.None);
    }

    [TestMethod]
    public async Task Lockdown_closes_a_platform_database_to_everyone_but_its_owner()
    {
        var admin = Admin();
        var superuser = ConnectionString("postgres", "postgres", Containers.PostgresPassword);
        await ExecAsync(superuser, "create database it_controldb");
        await admin.EnsureRoleAsync("nosy_app", "nosy-password-1234567890", CancellationToken.None);

        // Before: PUBLIC may connect to a database the superuser made
        await ExecAsync(ConnectionString("it_controldb", "nosy_app", "nosy-password-1234567890"), "select 1");

        await admin.LockDownAsync("it_controldb", CancellationToken.None);

        await Assert.ThrowsExactlyAsync<PostgresException>(() => ExecAsync(ConnectionString("it_controldb", "nosy_app", "nosy-password-1234567890"), "select 1"));
        await admin.DropRoleAsync("nosy_app", CancellationToken.None);
        await admin.DropDatabaseAsync("it_controldb", CancellationToken.None);
    }
}
