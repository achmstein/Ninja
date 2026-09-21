using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// The upgrade and its rollback, run for real over an in-memory record, the
/// dry-run box and a stack whose health can be made to fail: what the steps
/// are, what the record says afterwards, and what is on disk.
/// </summary>
[TestClass]
public sealed class ProvisionerTests
{
    private string _root = null!;
    private ControlContext _context = null!;
    private RecordingShell _shell = null!;
    private FailingStack _stack = null!;
    private CollectingAudit _audit = null!;
    private PlatformOptions _platform = null!;
    private Provisioner _provisioner = null!;
    private Tenant _tenant = null!;

    private sealed class FailingStack : ITenantStack
    {
        public int FailHealthTimes { get; set; }
        public int HealthCalls { get; private set; }
        public Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct)
        {
            HealthCalls++;
            return HealthCalls <= FailHealthTimes ? throw new TimeoutException("still not healthy: catalog") : Task.CompletedTask;
        }
        public Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct) => Task.CompletedTask;
        public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(null);
        public Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class CollectingAudit : IAuditWriter
    {
        public List<(string Action, string? Slug)> Entries { get; } = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) { Entries.Add((action, slug)); return Task.CompletedTask; }
    }

    [TestInitialize]
    public async Task Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-provisioner-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
        _platform = new PlatformOptions { TenantsRoot = _root, PullImages = false, BackupFreshMinutes = 60 };
        var options = Options.Create(_platform);
        _context = new ControlContext(new DbContextOptionsBuilder<ControlContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _stack = new FailingStack();
        _audit = new CollectingAudit();
        var backups = new BackupService(_shell, new RecordingOffsiteStore(), options, NullLogger<BackupService>.Instance);
        _provisioner = new Provisioner(_context, options, _shell,
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance),
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance),
            _stack, _audit, backups, new MailQueue(), NullLogger<Provisioner>.Instance);

        _tenant = new Tenant
        {
            Slug = "blue", NameEn = "Blue", Kind = TenantKind.Customer, Status = TenantStatus.Running, Plan = TenantPlan.Pro,
            OwnerEmail = "owner@blue.test", IdentitySecret = TenantNaming.NewSecret(), ControlSecret = TenantNaming.NewSecret(), ImageTag = "v1",
        };
        _context.Tenants.Add(_tenant);
        await _context.SaveChangesAsync();
        // The stack folder exists, as it would for a stamped tenant
        Directory.CreateDirectory(Path.Combine(_root, "blue"));
    }

    [TestCleanup]
    public void Cleanup()
    {
        _context.Dispose();
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private IEnumerable<string> Steps() => _context.Steps.OrderBy(s => s.Id).Select(s => $"{s.Name}:{s.Status}");

    private string ComposeOnDisk() => File.ReadAllText(Path.Combine(_root, "blue", "docker-compose.yaml"));

    [TestMethod]
    public async Task An_upgrade_backs_up_first_moves_the_tags_and_ends_running()
    {
        await _provisioner.UpgradeAsync(_tenant.Id, "v2", null, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "credentials:Done", "databases:Done", "broker:Done", "backup:Done", "stack:Done", "health:Done", "broker-lockdown:Done" }, Steps().ToList());
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.AreEqual("v2", _tenant.ImageTag);
        Assert.AreEqual("v1", _tenant.PreviousImageTag);
        Assert.IsNotNull(_tenant.UpgradeBackupId);
        Assert.IsTrue(_tenant.HasOwnCredentials, "a re-stamp gives an old stack its own credentials");
        Assert.Contains(":v2\"", ComposeOnDisk());
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.upgrade.done"));
        Assert.IsTrue(_shell.Commands.Any(c => c.Contains("compose -p ninja-blue up -d")), "the stack was brought up");

        // A second upgrade within the hour reuses the backup it just took
        await _provisioner.UpgradeAsync(_tenant.Id, "v3", null, CancellationToken.None);
        var reused = _context.Steps.OrderByDescending(s => s.Id).First(s => s.Name == "backup");
        StringAssert.StartsWith(reused.Output, "reusing");
        Assert.AreEqual("v2", _tenant.PreviousImageTag);
    }

    [TestMethod]
    public async Task An_upgrade_whose_stack_is_not_healthy_rolls_back_to_the_previous_tag()
    {
        _stack.FailHealthTimes = 1;

        await _provisioner.UpgradeAsync(_tenant.Id, "v2", null, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "credentials:Done", "databases:Done", "broker:Done", "backup:Done", "stack:Done", "health:Failed", "rollback:Done", "rollback-health:Done" }, Steps().ToList());
        Assert.AreEqual(TenantStatus.Running, _tenant.Status, "the café is back on what worked");
        Assert.AreEqual("v1", _tenant.ImageTag);
        Assert.IsNull(_tenant.PreviousImageTag, "the tag that failed is nothing to go back to");
        StringAssert.StartsWith(_tenant.LastError, "upgrade to v2 rolled back");
        Assert.Contains(":v1\"", ComposeOnDisk());
        Assert.DoesNotContain(":v2\"", ComposeOnDisk());
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.upgrade.rolledback"));
    }

    [TestMethod]
    public async Task An_upgrade_on_the_same_tag_has_nothing_to_roll_back_to_and_fails_plainly()
    {
        _stack.FailHealthTimes = 1;

        await _provisioner.UpgradeAsync(_tenant.Id, "v1", null, CancellationToken.None);

        Assert.AreEqual(TenantStatus.Failed, _tenant.Status);
        Assert.IsNull(_tenant.PreviousImageTag);
        Assert.IsFalse(Steps().Any(s => s.StartsWith("rollback")));
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.upgrade.failed"));
    }

    [TestMethod]
    public async Task A_rollback_by_hand_swaps_the_tags_and_restamps()
    {
        await _provisioner.UpgradeAsync(_tenant.Id, "v2", null, CancellationToken.None);
        _context.Steps.RemoveRange(_context.Steps);
        await _context.SaveChangesAsync();

        await _provisioner.RollbackAsync(_tenant.Id, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "rollback:Done", "rollback-health:Done" }, Steps().ToList());
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.AreEqual("v1", _tenant.ImageTag);
        Assert.AreEqual("v2", _tenant.PreviousImageTag);
        Assert.IsNull(_tenant.LastError);
        Assert.Contains(":v1\"", ComposeOnDisk());
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.rollback.done"));
    }

    [TestMethod]
    public async Task The_rest_of_a_fleet_upgrade_steps_aside_when_the_canary_did_not_make_it()
    {
        var canary = new Tenant
        {
            Slug = "red", NameEn = "Red", Kind = TenantKind.Customer, Status = TenantStatus.Failed, ImageTag = "v2",
            OwnerEmail = "o@red.test", IdentitySecret = TenantNaming.NewSecret(), ControlSecret = TenantNaming.NewSecret(),
        };
        _context.Tenants.Add(canary);
        await _context.SaveChangesAsync();

        await _provisioner.UpgradeAsync(_tenant.Id, "v2", canary.Id, CancellationToken.None);

        Assert.IsEmpty(Steps().ToList(), "nothing ran");
        Assert.AreEqual("v1", _tenant.ImageTag);
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.upgrade.skipped" && e.Slug == "blue"));

        // Once the canary stands on the tag, the rest go
        canary.Status = TenantStatus.Running;
        await _context.SaveChangesAsync();
        await _provisioner.UpgradeAsync(_tenant.Id, "v2", canary.Id, CancellationToken.None);
        Assert.AreEqual("v2", _tenant.ImageTag);
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
    }

    /// <summary>A shell that records like the dry run's but fails one command.</summary>
    private sealed class FailingShell(RecordingShell inner, string failing) : IShell
    {
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
            => args.Contains(failing) ? Task.FromResult(new ShellResult(1, $"{failing}: refused")) : inner.RunAsync(file, args, workingDirectory, ct);
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
            => inner.RunAsync(file, args, workingDirectory, stdin, stdout, ct);
    }

    [TestMethod]
    public async Task The_edge_file_is_checked_by_caddy_and_put_back_when_it_is_refused()
    {
        _platform.EdgeSnippetPath = Path.Combine(_root, "custom-domains.caddy");
        await File.WriteAllTextAsync(_platform.EdgeSnippetPath, "# before\n");
        _tenant.CustomerDomain = "menu.blue.test";
        await _context.SaveChangesAsync();
        var options = Options.Create(_platform);
        var backups = new BackupService(_shell, new RecordingOffsiteStore(), options, NullLogger<BackupService>.Instance);
        var provisioner = new Provisioner(_context, options, new FailingShell(_shell, "validate"),
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance),
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance),
            _stack, _audit, backups, new MailQueue(), NullLogger<Provisioner>.Instance);

        await provisioner.EdgeAsync(_tenant.Id, CancellationToken.None);

        Assert.AreEqual("# before\n", await File.ReadAllTextAsync(_platform.EdgeSnippetPath), "the file Caddy could not parse is gone");
        StringAssert.Contains(_tenant.LastError, "Caddy refused");
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.edge.failed"));
        Assert.IsFalse(_shell.Commands.Any(c => c.Contains("caddy reload")), "nothing was reloaded");

        // With Caddy happy, the file is written and reloaded
        await _provisioner.EdgeAsync(_tenant.Id, CancellationToken.None);
        StringAssert.Contains(await File.ReadAllTextAsync(_platform.EdgeSnippetPath), "https://menu.blue.test {");
        Assert.IsTrue(_shell.Commands.Any(c => c.Contains("caddy validate")));
        Assert.IsTrue(_shell.Commands.Any(c => c.Contains("caddy reload")));
    }
}
