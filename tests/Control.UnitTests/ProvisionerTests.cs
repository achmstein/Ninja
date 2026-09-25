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
    private FailingShell _box = null!;
    private FailingStack _stack = null!;
    private CollectingAudit _audit = null!;
    private PlatformOptions _platform = null!;
    private Provisioner _provisioner = null!;
    private DryRunBrokerAdmin _broker = null!;
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
        public JsonObject? SeededBrand { get; private set; }
        public Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct) { SeededBrand = brand; return Task.CompletedTask; }
        public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(null);
        public Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct) => Task.CompletedTask;
    }

    /// <summary>The dry-run box, except for the commands told to fail: each answers with the log given and exit 1, once, in order.</summary>
    private sealed class FailingShell(IShell inner) : IShell
    {
        public Queue<(string Match, string Log)> Failures { get; } = new();

        public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
        {
            var result = await inner.RunAsync(file, args, workingDirectory, ct);
            return Failures.TryPeek(out var f) && $"{file} {string.Join(' ', args)}".Contains(f.Match, StringComparison.Ordinal) ? new ShellResult(1, Failures.Dequeue().Log) : result;
        }

        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
            => inner.RunAsync(file, args, workingDirectory, stdin, stdout, ct);
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
        _box = new FailingShell(_shell);
        _stack = new FailingStack();
        _audit = new CollectingAudit();
        var backups = new BackupService(_box, new RecordingOffsiteStore(), options, NullLogger<BackupService>.Instance);
        _broker = new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance);
        _provisioner = new Provisioner(_context, options, _box,
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            _broker,
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance),
            _stack, _audit, backups, NullLogger<Provisioner>.Instance);

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

    private async Task OnPlanAsync(TenantPlan plan, TenantStatus status = TenantStatus.Running)
    {
        _tenant.Plan = plan;
        _tenant.Status = status;
        _tenant.DbPassword ??= TenantNaming.NewPassword();
        _tenant.BrokerPassword ??= TenantNaming.NewPassword();
        await _context.SaveChangesAsync();
    }

    private static readonly string[] ModuleServices = ["inventory", "finance", "payroll", "loyalty", "accounts"];

    private static void AssertShape(string yaml, params string[] present)
    {
        foreach (var service in ModuleServices)
        {
            if (present.Contains(service)) Assert.Contains($"blue-{service}-api:", yaml, $"{service} is in the plan");
            else Assert.DoesNotContain($"blue-{service}-api:", yaml, $"{service} is not in the plan");
        }
        Assert.Contains("blue-spaces-api:", yaml, "spaces always runs");
    }

    /// <summary>Whether a guest may order away from a table is chosen when the café is created, and the stack starts with it.</summary>
    [TestMethod]
    public async Task A_fresh_stack_starts_with_the_guest_ordering_the_cafe_was_created_with()
    {
        _tenant.Status = TenantStatus.Requested;
        _tenant.GuestOrdersAnywhere = true;
        // No edge on this box to reload
        _platform.DryRun = true;
        _platform.EdgeSnippetPath = Path.Combine(_root, "no-edge", "custom-domains.caddy");
        await _context.SaveChangesAsync();

        await _provisioner.ProvisionAsync(_tenant.Id, CancellationToken.None);

        Assert.IsNotNull(_stack.SeededBrand, string.Join(", ", Steps()));
        Assert.IsTrue(_stack.SeededBrand["guestOrdersAnywhere"]!.GetValue<bool>());
    }

    /// <summary>An upgrade (or a rollback) rewrites the compose from the plan: a Starter café stays without inventory, finance and payroll.</summary>
    [TestMethod]
    public async Task An_upgrade_keeps_the_stack_in_the_plans_shape()
    {
        await OnPlanAsync(TenantPlan.Starter);

        await _provisioner.UpgradeAsync(_tenant.Id, "v2", null, CancellationToken.None);

        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.AreEqual("v2", _tenant.ImageTag);
        AssertShape(ComposeOnDisk(), "loyalty", "accounts");
        CollectionAssert.AreEqual(new[] { "credentials:Done", "databases:Done", "broker:Done", "backup:Done", "stack:Done", "health:Done", "broker-lockdown:Done" }, Steps().ToList());
    }

    /// <summary>Up to Pro: every service is stamped and no queue is touched; down to Free: five go, with their queues.</summary>
    [TestMethod]
    public async Task A_plan_going_up_stamps_every_service_and_going_down_takes_five_away_with_their_queues()
    {
        await OnPlanAsync(TenantPlan.Pro);
        await _provisioner.EntitlementsAsync(_tenant.Id, CancellationToken.None);
        AssertShape(ComposeOnDisk(), ModuleServices);
        Assert.IsEmpty(_broker.DeletedQueues, "on Pro every service runs; nothing to drop");
        Assert.AreEqual("every service runs", _context.Steps.Single(s => s.Name == "queues").Output);

        await OnPlanAsync(TenantPlan.Free);
        await _provisioner.EntitlementsAsync(_tenant.Id, CancellationToken.None);
        AssertShape(ComposeOnDisk());
        CollectionAssert.AreEquivalent(new[] { "blue/Inventory", "blue/Payroll", "blue/Finance", "blue/Loyalty", "blue/Accounts" }, _broker.DeletedQueues);
        Assert.IsTrue(_shell.Commands.Count(c => c.Contains("compose -p ninja-blue up -d --remove-orphans")) >= 2, "each change is an up; the orphans go with it");
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
    }

    /// <summary>A plan that changes while the stack is down rewrites the files and drops the queues now; the start applies the shape and tells Branch.API.</summary>
    [TestMethod]
    public async Task A_plan_change_while_stopped_waits_for_the_start_to_take_the_containers_down()
    {
        await OnPlanAsync(TenantPlan.Free, TenantStatus.Stopped);

        await _provisioner.EntitlementsAsync(_tenant.Id, CancellationToken.None);
        CollectionAssert.AreEqual(new[] { "stack:Done", "queues:Done" }, Steps().ToList(), "no health and no push while the stack is down");
        Assert.AreEqual("files rewritten; applied on start", _context.Steps.Single(s => s.Name == "stack").Output);
        Assert.AreEqual(5, _broker.DeletedQueues.Count);
        Assert.IsFalse(_shell.Commands.Any(c => c.Contains("compose -p ninja-blue up")), "a stopped stack is not started by a plan change");
        AssertShape(ComposeOnDisk());

        await _provisioner.ComposeAsync(_tenant.Id, "start", CancellationToken.None);
        CollectionAssert.AreEqual(new[] { "stack:Done", "queues:Done", "start:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps().ToList());
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.IsTrue(_shell.Commands.Any(c => c.Contains("compose -p ninja-blue up -d --remove-orphans")), "the start is an up, so the orphans go");
        Assert.AreEqual(10, _broker.DeletedQueues.Count, "the start drops them again; gone twice is nothing");
    }

    /// <summary>Stop and start on a plan: the shape holds, and the start tells Branch.API once the stack answers.</summary>
    [TestMethod]
    public async Task A_stop_and_a_start_keep_the_plans_shape()
    {
        await OnPlanAsync(TenantPlan.Starter);

        await _provisioner.ComposeAsync(_tenant.Id, "stop", CancellationToken.None);
        Assert.AreEqual(TenantStatus.Stopped, _tenant.Status);
        await _provisioner.ComposeAsync(_tenant.Id, "start", CancellationToken.None);

        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        CollectionAssert.AreEqual(new[] { "stop:Done", "start:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps().ToList());
        AssertShape(ComposeOnDisk(), "loyalty", "accounts");
        CollectionAssert.AreEquivalent(new[] { "blue/Inventory", "blue/Payroll", "blue/Finance" }, _broker.DeletedQueues);
    }

    [TestMethod]
    public async Task A_plan_change_restamps_the_stack_without_the_modules_it_lost_and_drops_their_queues()
    {
        _tenant.Plan = TenantPlan.Starter;
        _tenant.DbPassword = TenantNaming.NewPassword();
        _tenant.BrokerPassword = TenantNaming.NewPassword();
        await _context.SaveChangesAsync();

        await _provisioner.EntitlementsAsync(_tenant.Id, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "stack:Done", "queues:Done", "health:Done", "entitlements:Done" }, Steps().ToList());
        Assert.IsTrue(_shell.Commands.Any(c => c.Contains("compose -p ninja-blue up -d --remove-orphans")), "the orphaned containers go with the up");
        var yaml = ComposeOnDisk();
        Assert.DoesNotContain("blue-inventory-api:", yaml);
        Assert.DoesNotContain("blue-finance-api:", yaml);
        Assert.DoesNotContain("blue-payroll-api:", yaml);
        Assert.Contains("blue-loyalty-api:", yaml);
        var queues = _context.Steps.Single(s => s.Name == "queues").Output ?? "";
        foreach (var queue in new[] { "Inventory", "Payroll", "Finance" }) Assert.Contains(queue, queues);
        Assert.DoesNotContain("Loyalty", queues);
        Assert.IsTrue(_audit.Entries.Any(e => e.Action == "tenant.entitlements.done"));
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
    }

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
    public async Task An_upgrade_to_images_nobody_has_keeps_the_compose_log_on_the_step_and_one_line_on_the_record()
    {
        _box.Failures.Enqueue(("compose -p ninja-blue up -d", ShellTests.PullDenied));

        await _provisioner.UpgradeAsync(_tenant.Id, "nope", null, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "credentials:Done", "databases:Done", "broker:Done", "backup:Done", "stack:Failed", "rollback:Done", "rollback-health:Done" }, Steps().ToList());
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        Assert.AreEqual("v1", _tenant.ImageTag);
        Assert.AreEqual(
            "upgrade to nope rolled back: pull access denied for ninja-inventory, repository does not exist or may require 'docker login': denied: requested access to the resource is denied",
            _tenant.LastError);
        Assert.Contains("Image ninja-spaces:nope Pulling", _context.Steps.Single(s => s.Name == "stack").Output!, "the step keeps everything compose printed");
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

    [TestMethod]
    public async Task The_edge_file_is_checked_by_caddy_and_put_back_when_it_is_refused()
    {
        _platform.EdgeSnippetPath = Path.Combine(_root, "custom-domains.caddy");
        await File.WriteAllTextAsync(_platform.EdgeSnippetPath, "# before\n");
        _tenant.CustomerDomain = "menu.blue.test";
        await _context.SaveChangesAsync();
        _box.Failures.Enqueue(("caddy validate", "validate: refused"));

        await _provisioner.EdgeAsync(_tenant.Id, CancellationToken.None);

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
