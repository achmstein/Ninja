using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// Every command the control plane runs on the box, through a tenant's whole
/// life, word for word against a file kept beside this test (Golden/). The
/// work that puts the docker calls behind a node (docs/multi-server-plan.md,
/// phase 1) must leave the box hearing exactly what it heard before: a
/// difference here is a change in behaviour, not a refactor.
///
/// Changing a command on purpose: delete the golden file and run the test
/// once; it writes what it heard and fails, so the new file is looked at and
/// committed with the change.
/// </summary>
[TestClass]
public sealed class GoldenCommandsTests
{
    private string _root = null!;
    private ControlContext _context = null!;
    private RecordingShell _shell = null!;
    private PlatformOptions _platform = null!;
    private BackupService _backups = null!;
    private Provisioner _provisioner = null!;

    private sealed class HealthyStack : ITenantStack
    {
        public Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct) => Task.CompletedTask;
        public Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct) => Task.CompletedTask;
        public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(null);
        public Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct) => Task.CompletedTask;
        public Task<string> ImportMenuAsync(Tenant tenant, string menu, CancellationToken ct) => Task.FromResult("");
    }

    private sealed class NoAudit : IAuditWriter
    {
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) => Task.CompletedTask;
    }

    [TestInitialize]
    public void Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-golden-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
        _platform = new PlatformOptions
        {
            TenantsRoot = _root,
            PullImages = false,
            BackupFreshMinutes = 60,
            EdgeSnippetPath = Path.Combine(_root, "custom-domains.caddy"),
        };
        var options = Options.Create(_platform);
        _context = new ControlContext(new DbContextOptionsBuilder<ControlContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _shell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _backups = new BackupService(_shell, new RecordingOffsiteStore(), options, NullLogger<BackupService>.Instance);
        _provisioner = new Provisioner(_context, options, _shell,
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance),
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance),
            new HealthyStack(), new NoAudit(), _backups, NullLogger<Provisioner>.Instance);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _context.Dispose();
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private async Task<Tenant> AddAsync(string slug, TenantStatus status)
    {
        var tenant = new Tenant
        {
            Slug = slug, NameEn = slug, Kind = TenantKind.Customer, Status = status, Plan = TenantPlan.Pro,
            OwnerEmail = $"owner@{slug}.test", IdentitySecret = TenantNaming.NewSecret(), ControlSecret = TenantNaming.NewSecret(), ImageTag = "v1",
            CustomerDomain = $"menu.{slug}.test",
        };
        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync();
        return tenant;
    }

    [TestMethod]
    public async Task A_tenants_whole_life_runs_the_same_commands_on_the_box()
    {
        var ct = CancellationToken.None;
        var heard = new List<string>();
        async Task Phase(string name, Func<Task> run)
        {
            _shell.Commands.Clear();
            await run();
            heard.Add($"## {name}");
            heard.AddRange(_shell.Commands);
        }

        var blue = await AddAsync("blue", TenantStatus.Requested);
        await Phase("provision", () => _provisioner.ProvisionAsync(blue.Id, ct));
        await Phase("stop", () => _provisioner.ComposeAsync(blue.Id, "stop", ct));
        await Phase("start", () => _provisioner.ComposeAsync(blue.Id, "start", ct));
        await Phase("entitlements", () => _provisioner.EntitlementsAsync(blue.Id, ct));
        await Phase("backup", () => _provisioner.BackupAsync(blue.Id, ct));
        await Phase("upgrade", () => _provisioner.UpgradeAsync(blue.Id, "v2", null, ct));
        await Phase("rollback", () => _provisioner.RollbackAsync(blue.Id, ct));
        await Phase("edge", () => _provisioner.EdgeAsync(blue.Id, ct));

        var ops = new TenantOps(_shell, null!);
        await Phase("containers", () => ops.ContainersAsync(blue, ct));
        await Phase("logs", () => ops.LogsAsync(blue, "catalog", 50, ct));

        var green = await AddAsync("green", TenantStatus.Requested);
        var backupId = (await _context.Tenants.SingleAsync(t => t.Id == blue.Id, ct)).UpgradeBackupId!;
        await Phase("restore-databases", () => _backups.RestoreDatabasesAsync("blue", backupId, green, ct));
        await Phase("restore-uploads", () => _backups.RestoreUploadsAsync("blue", backupId, green, ct));

        var broker = new RabbitCtlBrokerAdmin(_shell, Options.Create(_platform));
        await Phase("broker", async () =>
        {
            await broker.EnsureUserAsync("blue", "secret", ct);
            await broker.EnsureVHostAsync("blue", "blue", ct);
            await broker.DeleteQueueAsync("blue", "catalog", ct);
            await broker.ClearPermissionsAsync("blue", "blue", ct);
            await broker.DeleteVHostAsync("blue", ct);
            await broker.DeleteUserAsync("blue", ct);
        });

        var capacity = new ProcHostCapacity(_shell, Options.Create(_platform), NullLogger<ProcHostCapacity>.Instance);
        await Phase("capacity", () => capacity.ProbeAsync(ct));

        await Phase("destroy", () => _provisioner.DestroyAsync(blue.Id, ct));

        await CompareAsync(Normalize(heard, blue, green, backupId));
    }

    /// <summary>What differs run to run (the temp folder, secrets, ids, times) put in words, so only the commands are compared.</summary>
    private string Normalize(List<string> lines, Tenant blue, Tenant green, string backupId)
    {
        var secrets = new[] { blue.IdentitySecret, blue.ControlSecret, green.IdentitySecret, green.ControlSecret, blue.DbPassword, blue.BrokerPassword, green.DbPassword, green.BrokerPassword }
            .Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        var text = string.Join('\n', lines);
        text = text.Replace(_root, "{root}").Replace(_root.Replace('\\', '/'), "{root}").Replace('\\', '/');
        text = text.Replace(backupId, "{backup}");
        foreach (var s in secrets) text = text.Replace(s!, "{secret}");
        text = Regex.Replace(text, @"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{guid}");
        text = Regex.Replace(text, @"\b\d{8}[-T]?\d{6}\w*\b", "{stamp}");
        return text + '\n';
    }

    private static async Task CompareAsync(string actual, [CallerFilePath] string here = "")
    {
        var golden = Path.Combine(Path.GetDirectoryName(here)!, "Golden", "box-commands.txt");
        if (!File.Exists(golden))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(golden)!);
            await File.WriteAllTextAsync(golden, actual);
            Assert.Fail($"No golden file yet: wrote {golden}. Look it over, commit it, and run again.");
        }
        var expected = (await File.ReadAllTextAsync(golden)).Replace("\r\n", "\n");
        if (expected == actual) return;
        var e = expected.Split('\n');
        var a = actual.Split('\n');
        var at = Enumerable.Range(0, Math.Min(e.Length, a.Length)).FirstOrDefault(i => e[i] != a[i], Math.Min(e.Length, a.Length));
        Assert.Fail($"The box would hear something else, first at line {at + 1}:\n  was: {e.ElementAtOrDefault(at)}\n  now: {a.ElementAtOrDefault(at)}");
    }
}
