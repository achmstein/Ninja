using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class BackupTests
{
    private string _root = null!;
    private BackupService _backups = null!;

    [TestInitialize]
    public void Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-backup-tests", Guid.NewGuid().ToString("N"));
        var shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _backups = new BackupService(shell, Options.Create(new PlatformOptions { TenantsRoot = _root }), NullLogger<BackupService>.Instance);
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
}
