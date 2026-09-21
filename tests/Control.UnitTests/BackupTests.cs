using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class BackupTests
{
    private string _root = null!;
    private RecordingShell _shell = null!;
    private RecordingOffsiteStore _store = null!;
    private BackupService _backups = null!;

    [TestInitialize]
    public void Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-backup-tests", Guid.NewGuid().ToString("N"));
        _shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _store = new RecordingOffsiteStore();
        _backups = new BackupService(_shell, _store, Options.Create(new PlatformOptions { TenantsRoot = _root, Offsite = { Prefix = "ninja/" } }), NullLogger<BackupService>.Instance);
    }

    [TestCleanup]
    public void Cleanup()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [TestMethod]
    public async Task A_backup_is_a_folder_of_dumps_with_a_manifest_and_the_newest_lists_first()
    {
        var tenant = new Tenant { Slug = "blue", ImageTag = "v7" };

        var first = await _backups.CreateAsync(tenant, CancellationToken.None);
        await Task.Delay(1100);
        var second = await _backups.CreateAsync(tenant, CancellationToken.None);

        Assert.IsTrue(BackupService.IsValidId(first.Id));
        Assert.AreEqual("v7", first.ImageTag);
        Assert.AreEqual(TenantNaming.Databases.Length, Directory.EnumerateFiles(_backups.Dir("blue", first.Id), "*.dump").Count());
        Assert.IsTrue(File.Exists(Path.Combine(_backups.Dir("blue", first.Id), "manifest.json")));

        var listed = _backups.List("blue");
        CollectionAssert.AreEqual(new[] { second.Id, first.Id }, listed.Select(b => b.Id).ToList());
        Assert.IsNotNull(_backups.Find("blue", first.Id));
        Assert.AreEqual(0, _backups.List("nobody").Count);
    }

    [TestMethod]
    public async Task Pruning_keeps_the_newest_and_delete_refuses_to_walk_out_of_the_folder()
    {
        var tenant = new Tenant { Slug = "blue" };
        var ids = new List<string>();
        for (var i = 0; i < 3; i++)
        {
            ids.Add((await _backups.CreateAsync(tenant, CancellationToken.None)).Id);
            await Task.Delay(1100);
        }

        Assert.AreEqual(1, _backups.Prune("blue", keep: 2));
        CollectionAssert.AreEqual(new[] { ids[2], ids[1] }, _backups.List("blue").Select(b => b.Id).ToList());

        Assert.IsFalse(_backups.Delete("blue", "../../etc"));
        Assert.IsFalse(BackupService.IsValidId("20260919-1200"));
        Assert.IsTrue(BackupService.IsValidId("20260919-120000"));
        Assert.IsTrue(_backups.Delete("blue", ids[2]));
        Assert.AreEqual(1, _backups.List("blue").Count);
    }

    [TestMethod]
    public void Restore_from_names_a_slug_and_a_backup_and_nothing_else()
    {
        Assert.AreEqual(("blue", "20260919-120000"), BackupService.ParseRestoreFrom("blue/20260919-120000"));
        Assert.IsNull(BackupService.ParseRestoreFrom(null));
        Assert.IsNull(BackupService.ParseRestoreFrom("blue"));
        Assert.IsNull(BackupService.ParseRestoreFrom("Blue Bottle/20260919-120000"));
        Assert.IsNull(BackupService.ParseRestoreFrom("blue/../x"));
    }

    [TestMethod]
    public async Task A_restore_loads_the_dumps_as_the_new_tenants_own_role()
    {
        var source = new Tenant { Slug = "blue" };
        var backup = await _backups.CreateAsync(source, CancellationToken.None);
        _shell.Commands.Clear();

        await _backups.RestoreDatabasesAsync("blue", backup.Id, new Tenant { Slug = "red" }, CancellationToken.None);

        Assert.AreEqual(TenantNaming.Databases.Length, _shell.Commands.Count);
        // --no-owner alone would leave the superuser owning every restored table; the role could neither migrate nor write them
        StringAssert.Contains(_shell.Commands[0], "pg_restore -U postgres --no-owner --role red_app --clean --if-exists -d red_accountsdb");
    }

    [TestMethod]
    public async Task The_platform_backup_dumps_controldb_and_keycloak_under_its_own_name()
    {
        var info = await _backups.CreatePlatformAsync(CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "controldb", "keycloak" }, info.Databases.ToArray());
        Assert.IsFalse(info.HasUploads);
        Assert.IsTrue(_shell.Commands.Any(c => c.EndsWith("pg_dump -U postgres -Fc controldb")));
        Assert.IsTrue(_shell.Commands.Any(c => c.EndsWith("pg_dump -U postgres -Fc keycloak")));
        Assert.IsTrue(Directory.Exists(Path.Combine(_root, "_platform", "backups", info.Id)));
        Assert.AreEqual(info.Id, _backups.List(BackupService.PlatformSlug).Single().Id);
        // No tenant can be restored from it, and no slug can collide with it
        Assert.IsNull(BackupService.ParseRestoreFrom($"_platform/{info.Id}"));
        Assert.IsFalse(TenantNaming.IsValidSlug("_platform"));
    }

    [TestMethod]
    public async Task Offsite_sends_one_archive_per_backup_and_marks_the_manifest()
    {
        var created = await _backups.CreateAsync(new Tenant { Slug = "blue" }, CancellationToken.None);
        Assert.IsNull(created.OffsiteAt);

        var sent = await _backups.OffsiteAsync("blue", created.Id, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { $"ninja/blue/{created.Id}.tar.gz" }, _store.Keys);
        Assert.IsNotNull(sent.OffsiteAt);
        Assert.IsNotNull(_backups.Find("blue", created.Id)!.OffsiteAt, "the manifest on disk remembers");
        Assert.IsFalse(Directory.EnumerateFiles(_backups.Root("blue"), "*.tmp").Any(), "the archive was only ever a stepping stone");

        await _backups.DeleteOffsiteAsync("blue", created.Id, CancellationToken.None);
        Assert.IsEmpty(_store.Keys);
    }

    [TestMethod]
    public async Task Archiving_moves_the_newest_backup_out_of_the_tenant_folder_and_pruning_ages_it_out()
    {
        var tenant = new Tenant { Slug = "blue" };
        var older = await _backups.CreateAsync(tenant, CancellationToken.None);
        await Task.Delay(1100);
        var newest = await _backups.CreateAsync(tenant, CancellationToken.None);

        Assert.AreEqual(newest.Id, _backups.ArchiveLatest("blue"));
        Assert.IsTrue(Directory.Exists(Path.Combine(_root, "_archive", "blue", newest.Id)));
        Assert.AreEqual(older.Id, _backups.List("blue").Single().Id, "the older one stays where destroy will delete it");

        // Nothing is old enough yet; an archive dated ninety-one days back is
        Assert.AreEqual(0, _backups.PruneArchive(90));
        var stale = Path.Combine(_root, "_archive", "red", DateTimeOffset.UtcNow.AddDays(-91).ToString("yyyyMMdd-HHmmss"));
        Directory.CreateDirectory(stale);
        Assert.AreEqual(1, _backups.PruneArchive(90));
        Assert.IsFalse(Directory.Exists(Path.Combine(_root, "_archive", "red")), "an emptied tenant folder goes too");
        Assert.IsNull(_backups.ArchiveLatest("nobody"));
    }

    [TestMethod]
    public async Task A_backup_is_fresh_for_the_window_and_stale_after_a_missed_night()
    {
        Assert.IsFalse(_backups.IsFresh("blue", 60, out var none));
        Assert.IsNull(none);
        var created = await _backups.CreateAsync(new Tenant { Slug = "blue" }, CancellationToken.None);
        Assert.IsTrue(_backups.IsFresh("blue", 60, out var newest));
        Assert.AreEqual(created.Id, newest!.Id);
        Assert.IsFalse(_backups.IsFresh("blue", 0, out _));

        var now = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);
        Assert.IsTrue(PlatformBackupService.IsStale(null, now));
        Assert.IsTrue(PlatformBackupService.IsStale(now.AddHours(-27), now));
        Assert.IsFalse(PlatformBackupService.IsStale(now.AddHours(-25), now));
    }

    [TestMethod]
    public void The_weekly_run_lands_on_the_weekday_at_the_hour()
    {
        // Wednesday 2026-07-01 22:00 UTC (Thursday 01:00 Cairo): Sunday 04:00 Cairo is 3 days and 3 hours away
        var wait = NightlyBackupService.UntilNextRun(new DateTimeOffset(2026, 7, 1, 22, 0, 0, TimeSpan.Zero), "Africa/Cairo", 4, DayOfWeek.Sunday);
        Assert.AreEqual(TimeSpan.FromDays(3) + TimeSpan.FromHours(3), wait);
    }

    [TestMethod]
    public void The_drill_picks_the_tenant_verified_longest_ago()
    {
        var now = DateTimeOffset.UtcNow;
        BackupInfo Backup(DateTimeOffset? verified) => new("20260901-030000", now, 1, [], false, "v1", null, verified);
        var candidates = new List<(Tenant, BackupInfo)>
        {
            (new Tenant { Slug = "recent" }, Backup(now.AddDays(-1))),
            (new Tenant { Slug = "never" }, Backup(null)),
            (new Tenant { Slug = "old" }, Backup(now.AddDays(-30))),
        };
        Assert.AreEqual("never", RestoreDrillService.Pick(candidates)!.Value.Tenant.Slug);
        candidates.RemoveAt(1);
        Assert.AreEqual("old", RestoreDrillService.Pick(candidates)!.Value.Tenant.Slug);
        Assert.IsNull(RestoreDrillService.Pick([]));
    }

    [TestMethod]
    public void The_nightly_run_is_the_next_three_in_the_morning_in_the_platforms_zone()
    {
        // 01:00 UTC = 04:00 Cairo (summer): today's 03:00 has passed, so tomorrow's, 23 hours away
        var wait = NightlyBackupService.UntilNextRun(new DateTimeOffset(2026, 7, 1, 1, 0, 0, TimeSpan.Zero), "Africa/Cairo", 3);
        Assert.AreEqual(TimeSpan.FromHours(23), wait);

        // 22:00 UTC = 01:00 Cairo: today's 03:00 is two hours away
        wait = NightlyBackupService.UntilNextRun(new DateTimeOffset(2026, 7, 1, 22, 0, 0, TimeSpan.Zero), "Africa/Cairo", 3);
        Assert.AreEqual(TimeSpan.FromHours(2), wait);

        // An unknown zone falls back to UTC rather than never running
        wait = NightlyBackupService.UntilNextRun(new DateTimeOffset(2026, 7, 1, 2, 0, 0, TimeSpan.Zero), "Mars/Olympus", 3);
        Assert.AreEqual(TimeSpan.FromHours(1), wait);
    }

    [TestMethod]
    public void The_drill_tenant_is_never_the_customers_and_hears_nothing()
    {
        var source = new Tenant { Slug = "blue", NameEn = "Blue", Kind = TenantKind.Customer, OwnerEmail = "owner@blue.test", Country = "EG", Currency = "EGP", TimeZone = "Africa/Cairo", DefaultLanguage = "ar", ImageTag = "v3" };
        var newest = new BackupInfo("20260901-030000", DateTimeOffset.UtcNow, 1, [], false, "v2");
        var platform = new PlatformOptions { Domain = "ninja.app", Mail = new MailOptions { OpsTo = "Ops@Ninja.app" } };

        var drill = new Tenant { Slug = "drill-blue" };
        RestoreDrillService.Shape(drill, source, newest, platform);

        Assert.IsTrue(drill.IsDrill);
        Assert.AreEqual("ops@ninja.app", drill.OwnerEmail, "the realm's owner is ours, not the café's");
        Assert.IsNotNull(drill.WelcomeSentAt, "no welcome, no temporary password in anyone's inbox");
        Assert.AreEqual("v2", drill.ImageTag, "the build the backup was taken on");
        Assert.AreEqual("blue/20260901-030000", drill.RestoreFrom);
        Assert.AreEqual(TenantKind.Demo, drill.Kind);
        Assert.IsTrue(drill.ExpiresAt <= DateTimeOffset.UtcNow);
        // The demo sweep leaves it alone: the drill destroys it itself
        drill.Status = TenantStatus.Running;
        Assert.AreEqual(DemoAction.None, DemoExpiryService.Decide(drill, DateTimeOffset.UtcNow.AddHours(1), 7, 3, 2));

        // Without an ops address the owner is a platform address, still never the customer's
        RestoreDrillService.Shape(drill, source, newest, new PlatformOptions { Domain = "ninja.app" });
        Assert.AreEqual("drill@ninja.app", drill.OwnerEmail);
    }

    [TestMethod]
    public async Task A_backup_carries_a_checksum_per_file_and_a_corrupt_one_is_refused()
    {
        var created = await _backups.CreateAsync(new Tenant { Slug = "blue" }, CancellationToken.None);
        Assert.IsNotNull(created.Sha256);
        Assert.IsTrue(created.Sha256!.ContainsKey("catalogdb.dump"));
        Assert.IsFalse(created.Sha256.ContainsKey("manifest.json"), "the manifest cannot carry its own checksum");
        await _backups.VerifyAsync("blue", _backups.Find("blue", created.Id)!, CancellationToken.None);

        await File.WriteAllTextAsync(Path.Combine(_backups.Dir("blue", created.Id), "catalogdb.dump"), "garbage");
        var ex = await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _backups.OffsiteAsync("blue", created.Id, CancellationToken.None));
        StringAssert.Contains(ex.Message, "catalogdb.dump");
        Assert.IsEmpty(_store.Keys, "nothing corrupt leaves the box");
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _backups.RestoreDatabasesAsync("blue", created.Id, new Tenant { Slug = "red" }, CancellationToken.None));

        // A manifest from before checksums passes as it always did
        var legacy = created with { Sha256 = null };
        await _backups.VerifyAsync("blue", legacy, CancellationToken.None);
    }
}
