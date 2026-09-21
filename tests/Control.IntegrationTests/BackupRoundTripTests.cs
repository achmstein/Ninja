using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Npgsql;

namespace Ninja.Control.IntegrationTests;

/// <summary>pg_dump out of the shared Postgres container and pg_restore back in, as the platform does it: a tenant's databases into a new slug's, owned by the new role.</summary>
[TestClass]
public sealed class BackupRoundTripTests
{
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
    public async Task A_backup_dumps_every_database_verifies_and_restores_into_another_tenant_owned_by_its_role()
    {
        var admin = new NpgsqlDatabaseAdmin(Containers.Options);
        var backups = new BackupService(Containers.Shell, new RecordingOffsiteStore(), Containers.Options, NullLogger<BackupService>.Instance);
        var source = new Tenant { Slug = "amber", ImageTag = "v1" };
        var target = new Tenant { Slug = "copper" };
        var sourcePassword = TenantNaming.NewSecret();
        var targetPassword = TenantNaming.NewSecret();

        // The source's eleven databases, with a row in one
        await admin.EnsureRoleAsync(TenantNaming.DbRole(source.Slug), sourcePassword, CancellationToken.None);
        foreach (var db in TenantNaming.Databases)
            await admin.EnsureDatabaseAsync(TenantNaming.Database(source.Slug, db), TenantNaming.DbRole(source.Slug), CancellationToken.None);
        await ExecAsync(ConnectionString("amber_catalogdb", "amber_app", sourcePassword), "create table items (id serial primary key, name text); insert into items (name) values ('espresso'), ('cortado')");

        var backup = await backups.CreateAsync(source, CancellationToken.None);

        Assert.AreEqual(TenantNaming.Databases.Length, backup.Databases.Count);
        // docker run -v creates a named volume that is not there, so a tenant without a stack still yields an (empty) uploads archive
        Assert.IsTrue(backup.HasUploads);
        Assert.IsTrue(File.Exists(Path.Combine(backups.Dir(source.Slug, backup.Id), "uploads.tar.gz")));
        Assert.IsTrue(new FileInfo(Path.Combine(backups.Dir(source.Slug, backup.Id), "catalogdb.dump")).Length > 0, "a real dump, not an empty file");
        Assert.IsNotNull(backup.Sha256);
        await backups.VerifyAsync(source.Slug, backup, CancellationToken.None);

        // Into the target: empty databases owned by its own role, then the dumps
        await admin.EnsureRoleAsync(TenantNaming.DbRole(target.Slug), targetPassword, CancellationToken.None);
        foreach (var db in TenantNaming.Databases)
            await admin.EnsureDatabaseAsync(TenantNaming.Database(target.Slug, db), TenantNaming.DbRole(target.Slug), CancellationToken.None);
        await backups.RestoreDatabasesAsync(source.Slug, backup.Id, target, CancellationToken.None);

        var asCopper = ConnectionString("copper_catalogdb", "copper_app", targetPassword);
        Assert.AreEqual(2L, await ScalarAsync(asCopper, "select count(*) from items"));
        Assert.AreEqual("copper_app", await ScalarAsync(asCopper, "select pg_get_userbyid(relowner) from pg_class where relname = 'items'"), "restored as the new role, so a newer image can migrate it");
        await ExecAsync(asCopper, "alter table items add column price numeric");

        foreach (var slug in new[] { source.Slug, target.Slug })
        {
            foreach (var db in TenantNaming.Databases)
                await admin.DropDatabaseAsync(TenantNaming.Database(slug, db), CancellationToken.None);
            await admin.DropRoleAsync(TenantNaming.DbRole(slug), CancellationToken.None);
        }
    }
}
