using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Extensions;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.UnitTests;

/// <summary>
/// A tenant moved from one node to another, over two nodes that each record
/// what they hear: what runs where, in what order, what the record says after,
/// and how a failure before the switch is undone.
/// </summary>
[TestClass]
public sealed class MoveTests
{
    private string _root = null!;
    private ServiceProvider _services = null!;
    private ControlContext _context = null!;
    private PlatformOptions _platform = null!;
    private RecordingShell _oldShell = null!;
    private FailingShell _newShell = null!;
    private QueueingBroker _oldBroker = null!;
    private Provisioner _provisioner = null!;
    private Tenant _tenant = null!;

    /// <summary>Two boxes, each its own docker and folder: node 1 and node 2.</summary>
    private sealed class TwoNodes(INodeClient one, INodeClient two) : INodes
    {
        public INodeClient For(Tenant tenant) => For(tenant.NodeId);
        public INodeClient For(int nodeId) => nodeId == 1 ? one : two;
        public IReadOnlyList<Node> Known => [];
        public INodeClient Home => one;
    }

    /// <summary>A node whose name is its own, over the local parts.</summary>
    private sealed class NamedNode(LocalNodeClient inner, NodeRef node) : INodeClient
    {
        public NodeRef Node => node;
        public NodeEndpoints Endpoints => inner.Endpoints;
        public IStackRuntime Stacks => inner.Stacks;
        public INodeData Data => inner.Data;
        public IDatabaseAdmin Databases => inner.Databases;
        public IBrokerAdmin Broker => inner.Broker;
        public IHostCapacity Capacity => inner.Capacity;
        public IImageInventory Images => inner.Images;
        public StackRoute RouteTo(string slug) => inner.RouteTo(slug);
        public Task<Ninja.Control.NodeRuntime.AgentPing> PingAsync(CancellationToken ct) => inner.PingAsync(ct);
    }

    /// <summary>The dry run's broker, but with messages waiting until told otherwise.</summary>
    private sealed class QueueingBroker : IBrokerAdmin
    {
        public long Waiting { get; set; }
        public Task EnsureUserAsync(string user, string password, CancellationToken ct) => Task.CompletedTask;
        public Task EnsureVHostAsync(string vhost, string user, CancellationToken ct) => Task.CompletedTask;
        public Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct) => Task.CompletedTask;
        public Task DeleteVHostAsync(string vhost, CancellationToken ct) => Task.CompletedTask;
        public Task DeleteUserAsync(string user, CancellationToken ct) => Task.CompletedTask;
        public Task DeleteQueueAsync(string vhost, string queue, CancellationToken ct) => Task.CompletedTask;
        public Task<IReadOnlyDictionary<string, long>> QueueDepthsAsync(string vhost, CancellationToken ct)
            => Task.FromResult<IReadOnlyDictionary<string, long>>(new Dictionary<string, long> { ["ordering"] = Waiting, ["ninja_dead_letters"] = 3 });
    }

    /// <summary>The recording shell, except for the commands told to fail.</summary>
    private sealed class FailingShell(RecordingShell inner) : IShell
    {
        public RecordingShell Inner => inner;
        public string? FailOn { get; set; }
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
            => Fails(args) ? Task.FromResult(new ShellResult(1, "Error response from daemon: no space left on device")) : inner.RunAsync(file, args, workingDirectory, ct);
        public Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
            => Fails(args) ? Task.FromResult(new ShellResult(1, "failed")) : inner.RunAsync(file, args, workingDirectory, stdin, stdout, ct);
        private bool Fails(IReadOnlyList<string> args) => FailOn is not null && string.Join(' ', args).Contains(FailOn, StringComparison.Ordinal);
    }

    private sealed class HealthyStack : ITenantStack
    {
        public List<int> AskedOn { get; } = [];
        public Task WaitHealthyAsync(Tenant tenant, TimeSpan timeout, CancellationToken ct) { AskedOn.Add(tenant.NodeId); return Task.CompletedTask; }
        public Task SeedBrandAsync(Tenant tenant, JsonObject brand, IReadOnlyDictionary<string, string> images, CancellationToken ct) => Task.CompletedTask;
        public Task<JsonObject?> ReadBrandAsync(Tenant tenant, CancellationToken ct) => Task.FromResult<JsonObject?>(null);
        public Task PushEntitlementsAsync(Tenant tenant, JsonObject entitled, CancellationToken ct) => Task.CompletedTask;
        public Task<string> ImportMenuAsync(Tenant tenant, string menu, CancellationToken ct) => Task.FromResult("");
    }

    private sealed class NoAudit : IAuditWriter
    {
        public List<string> Actions { get; } = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null) { Actions.Add(action); return Task.CompletedTask; }
    }

    private HealthyStack _stack = null!;
    private NoAudit _audit = null!;

    [TestInitialize]
    public async Task Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-move-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_root, "one"));
        Directory.CreateDirectory(Path.Combine(_root, "two"));
        _platform = new PlatformOptions { TenantsRoot = Path.Combine(_root, "one"), PullImages = false, EdgeSnippetPath = Path.Combine(_root, "custom-domains.caddy") };
        var oneOptions = Options.Create(_platform);
        var twoOptions = Options.Create(new PlatformOptions { TenantsRoot = Path.Combine(_root, "two"), PullImages = false });

        var name = Guid.NewGuid().ToString();
        _services = new ServiceCollection()
            .AddLogging()
            .AddHttpContextAccessor()
            .AddDbContext<ControlContext>(o => o.UseInMemoryDatabase(name))
            .AddSingleton<ProvisioningQueue>()
            .BuildServiceProvider();
        _context = _services.CreateScope().ServiceProvider.GetRequiredService<ControlContext>();

        _oldShell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _newShell = new FailingShell(new RecordingShell(NullLogger<RecordingShell>.Instance));
        _oldBroker = new QueueingBroker();
        var dryDb = new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance);
        var one = new NamedNode(new LocalNodeClient(_oldShell, oneOptions, dryDb, _oldBroker, new ProcHostCapacity(_oldShell, new PlatformNodeSettings(oneOptions), NullLogger<ProcHostCapacity>.Instance)), new NodeRef(1, "node-1"));
        var two = new NamedNode(new LocalNodeClient(_newShell, twoOptions, dryDb, new DryRunBrokerAdmin(NullLogger<DryRunBrokerAdmin>.Instance), new ProcHostCapacity(_newShell, new PlatformNodeSettings(twoOptions), NullLogger<ProcHostCapacity>.Instance)), new NodeRef(2, "node-2"));
        var nodes = new TwoNodes(one, two);

        _stack = new HealthyStack();
        _audit = new NoAudit();
        _provisioner = new Provisioner(_context, oneOptions, nodes, new CaddyEdgeRouter(_context, _oldShell, oneOptions),
            new DryRunKeycloakAdmin(NullLogger<DryRunKeycloakAdmin>.Instance), _stack, _audit,
            new BackupService(nodes, new RecordingOffsiteStore(), oneOptions, NullLogger<BackupService>.Instance),
            NullLogger<Provisioner>.Instance, queue: _services.GetRequiredService<ProvisioningQueue>());

        _tenant = new Tenant
        {
            Slug = "blue", NameEn = "Blue", Kind = TenantKind.Customer, Status = TenantStatus.Running, Plan = TenantPlan.Pro, OwnerEmail = "o@blue.test", ImageTag = "v1",
            IdentitySecret = "i", ControlSecret = "c", DbPassword = "db-secret", BrokerPassword = "broker-secret", NodeId = 1, MovingToNodeId = 2,
        };
        _context.Tenants.Add(_tenant);
        await _context.SaveChangesAsync();
        // Stamped on node 1, as a running tenant is
        Directory.CreateDirectory(Path.Combine(_root, "one", "blue"));
        Provisioner.QueueDrain = TimeSpan.FromMilliseconds(300);
    }

    [TestCleanup]
    public void Cleanup()
    {
        _services.Dispose();
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private List<string> Steps() => _context.Steps.OrderBy(s => s.Id).Select(s => $"{s.Name}:{s.Status}").ToList();

    [TestMethod]
    public async Task A_move_closes_the_old_node_copies_everything_starts_the_new_one_then_switches()
    {
        await _provisioner.MoveAsync(_tenant.Id, CancellationToken.None);

        CollectionAssert.AreEqual(new[] { "move-prepare:Done", "move-quiesce:Done", "move-backup:Done", "move-restore:Done", "move-start:Done", "move-switch:Done", "edge:Done" }, Steps(), string.Join(", ", Steps()));
        Assert.AreEqual(2, _tenant.NodeId, "it lives on the new node");
        Assert.IsNull(_tenant.MovingToNodeId);
        Assert.AreEqual(TenantStatus.Running, _tenant.Status, "back as it was");
        Assert.IsNull(_tenant.StatusBeforeMove);
        CollectionAssert.AreEqual(new[] { 2 }, _stack.AskedOn, "its health was asked on the new node, before the switch");

        var old = _oldShell.Commands;
        var gatewayStop = old.FindIndex(c => c == "docker compose -p ninja-blue stop blue-gateway");
        var stackStop = old.FindIndex(c => c == "docker compose -p ninja-blue stop");
        var firstDump = old.FindIndex(c => c.Contains("pg_dump"));
        Assert.IsTrue(gatewayStop >= 0 && gatewayStop < stackStop && stackStop < firstDump, $"closed, stopped, then dumped:\n{string.Join('\n', old)}");
        Assert.AreEqual(TenantNaming.Databases.Length, old.Count(c => c.Contains("pg_dump")));
        Assert.IsFalse(old.Any(c => c.Contains("pg_restore") || c.Contains(" up -d")), "nothing restored or started on the old node");

        var fresh = _newShell.Inner.Commands;
        Assert.AreEqual(TenantNaming.Databases.Length, fresh.Count(c => c.Contains("pg_restore -U postgres --no-owner --role blue_app")), string.Join('\n', fresh));
        Assert.IsTrue(fresh.Any(c => c == "docker compose -p ninja-blue up -d --remove-orphans"), "started on the new node");
        Assert.IsTrue(File.Exists(Path.Combine(_root, "two", "blue", "docker-compose.yaml")), "its stack's files are on the new node");

        var cleanup = _context.Jobs.Single(j => j.Action == "move-cleanup");
        Assert.AreEqual(1, cleanup.NodeId, "the clean-up works on the old node");
        Assert.IsTrue(cleanup.NotBefore > DateTimeOffset.UtcNow.AddDays(6), "kept a week in case it is to be undone");
        Assert.AreEqual("", (await File.ReadAllTextAsync(Path.Combine(_root, "one", "blue", "moved-to"))).Split(' ')[^1].Replace("node-2", ""), "the old copy says where it went");
    }

    [TestMethod]
    public async Task A_new_node_that_will_not_start_it_is_cleared_and_the_old_one_runs_it_again()
    {
        _newShell.FailOn = "up -d";

        await _provisioner.MoveAsync(_tenant.Id, CancellationToken.None);

        Assert.AreEqual(1, _tenant.NodeId, "it stays where it was");
        Assert.IsNull(_tenant.MovingToNodeId);
        Assert.AreEqual(TenantStatus.Running, _tenant.Status);
        StringAssert.Contains(_tenant.LastError, "failed and was undone");
        StringAssert.Contains(_tenant.LastError, "no space left on device");
        Assert.IsTrue(_newShell.Inner.Commands.Any(c => c == "docker compose -p ninja-blue down -v --remove-orphans"), "the new node's copy is taken down");
        Assert.IsFalse(Directory.Exists(Path.Combine(_root, "two", "blue")), "and its files gone");
        Assert.AreEqual("docker compose -p ninja-blue up -d --remove-orphans", _oldShell.Commands[^1], "the old node runs it again, last of all");
        Assert.IsTrue(_audit.Actions.Contains("tenant.move.failed"));
        Assert.IsFalse(_context.Jobs.Any(j => j.Action == "move-cleanup"), "nothing to clear on the old node: it is the tenant's still");
    }

    [TestMethod]
    public async Task Messages_that_will_not_drain_stop_the_move_rather_than_be_lost()
    {
        _oldBroker.Waiting = 5;

        await _provisioner.MoveAsync(_tenant.Id, CancellationToken.None);

        Assert.AreEqual(1, _tenant.NodeId);
        StringAssert.Contains(_tenant.LastError, "5 message(s) were still queued");
        Assert.IsFalse(_oldShell.Commands.Any(c => c.Contains("pg_dump")), "nothing copied");
        Assert.AreEqual("docker compose -p ninja-blue up -d --remove-orphans", _oldShell.Commands[^1], "the gateway back with the rest");
    }

    [TestMethod]
    public async Task The_old_copy_is_cleared_once_its_time_is_up_and_never_where_the_tenant_lives_again()
    {
        await _provisioner.MoveAsync(_tenant.Id, CancellationToken.None);
        _oldShell.Commands.Clear();

        await _provisioner.MoveCleanupAsync(_tenant.Id, 1, CancellationToken.None);
        CollectionAssert.AreEqual(new[] { "docker compose -p ninja-blue down -v --remove-orphans" }, _oldShell.Commands);
        Assert.IsFalse(Directory.Exists(Path.Combine(_root, "one", "blue")));

        // Moved back since: the copy on node 2 is the tenant itself
        _tenant.NodeId = 2;
        await _context.SaveChangesAsync();
        _newShell.Inner.Commands.Clear();
        await _provisioner.MoveCleanupAsync(_tenant.Id, 2, CancellationToken.None);
        Assert.AreEqual(0, _newShell.Inner.Commands.Count);
        Assert.IsTrue(_audit.Actions.Contains("tenant.move.cleanup-skipped"));
    }
}
