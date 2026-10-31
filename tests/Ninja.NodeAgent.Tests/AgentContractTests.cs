using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;
using Ninja.Control.NodeRuntime;
using Ninja.NodeAgent;

namespace Ninja.NodeAgent.Tests;

/// <summary>
/// The agent's contract: a node part spoken to through the agent runs on the
/// node exactly what the same part runs on the box the control plane lives on,
/// and fails the same way. Each check runs the part twice, once on a recording
/// shell here and once through a real agent (in-process, its own recording
/// shell), and holds the two lists of commands to each other.
/// </summary>
[TestClass]
public sealed class AgentContractTests
{
    private string _root = null!;
    private WebApplicationFactory<AgentOptions> _agent = null!;
    private RecordingShell _agentShell = null!;
    private RecordingShell _localShell = null!;
    private INodeClient _local = null!;
    private INodeClient _remote = null!;
    private ScriptedShell? _failing;

    /// <summary>The recording shell, except for the commands told to fail.</summary>
    private sealed class ScriptedShell(IShell inner) : IShell
    {
        public string? FailOn { get; set; }
        public string Log { get; set; } = "";

        public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, CancellationToken ct)
            => Fails(args) ? new ShellResult(1, Log) : await inner.RunAsync(file, args, workingDirectory, ct);

        public async Task<ShellResult> RunAsync(string file, IReadOnlyList<string> args, string? workingDirectory, Stream? stdin, Stream stdout, CancellationToken ct)
            => Fails(args) ? new ShellResult(1, Log) : await inner.RunAsync(file, args, workingDirectory, stdin, stdout, ct);

        private bool Fails(IReadOnlyList<string> args) => FailOn is not null && string.Join(' ', args).Contains(FailOn, StringComparison.Ordinal);
    }

    [TestInitialize]
    public void Setup()
    {
        _root = Path.Combine(Path.GetTempPath(), "ninja-agent-tests", Guid.NewGuid().ToString("N"));
        var agentRoot = Path.Combine(_root, "agent");
        var localRoot = Path.Combine(_root, "local");
        Directory.CreateDirectory(agentRoot);
        Directory.CreateDirectory(localRoot);

        _agentShell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        _failing = new ScriptedShell(_agentShell);
        _agent = new WebApplicationFactory<AgentOptions>().WithWebHostBuilder(web =>
        {
            web.UseSetting("Agent:DryRun", "true");
            web.UseSetting("Agent:RequireClientCertificate", "false");
            web.UseSetting("Agent:BindSources:0", "/opt/ninja/platform/firebase.json");
            web.UseSetting("Node:TenantsRoot", agentRoot);
            web.ConfigureTestServices(services => services.AddSingleton<IShell>(_failing));
        });

        var platform = new PlatformOptions { Domain = "ninja.test", TenantsRoot = localRoot };
        var node = new Node { Id = 2, Name = "node-2", Kind = NodeKind.Agent, IngressUrl = "http://10.66.0.2:8088" };
        _remote = new AgentNodeClient(node, _agent.CreateClient(), platform);

        _localShell = new RecordingShell(NullLogger<RecordingShell>.Instance);
        var options = Options.Create(platform);
        _local = new LocalNodeClient(_localShell, options,
            new DryRunDatabaseAdmin(NullLogger<DryRunDatabaseAdmin>.Instance),
            new RabbitCtlBrokerAdmin(_localShell, new PlatformNodeSettings(options)),
            new ProcHostCapacity(_localShell, new PlatformNodeSettings(options), NullLogger<ProcHostCapacity>.Instance));
    }

    [TestCleanup]
    public void Cleanup()
    {
        _agent.Dispose();
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    /// <summary>The same work on both, then what each box heard, the paths of each box's own folder put in words.</summary>
    private async Task SameOnBothAsync(Func<INodeClient, Task> work)
    {
        await work(_local);
        await work(_remote);
        static IEnumerable<string> Heard(RecordingShell shell, string root) => shell.Commands.Select(c => c.Replace(root, "{root}"));
        Assert.IsTrue(_localShell.Commands.Count > 0, "the work ran commands to compare");
        CollectionAssert.AreEqual(
            Heard(_localShell, Path.Combine(_root, "local")).ToList(),
            Heard(_agentShell, Path.Combine(_root, "agent")).ToList(),
            $"through the agent:\n{string.Join('\n', _agentShell.Commands)}");
    }

    private static readonly StackFiles Files = new("services:\n  blue-catalog-api:\n    image: \"ghcr.io/achmstein/ninja-catalog:v1\"\n", "DB_PASSWORD=secret\n");

    [TestMethod]
    public async Task A_stacks_life_runs_the_same_compose_commands_through_the_agent()
    {
        await SameOnBothAsync(async node =>
        {
            Assert.IsFalse(await node.Stacks.IsStampedAsync("blue", default));
            await node.Stacks.WriteStackAsync("blue", Files, default);
            Assert.IsTrue(await node.Stacks.IsStampedAsync("blue", default));
            await node.Stacks.UpAsync("blue", pull: true, default);
            await node.Stacks.UpAsync("blue", pull: false, default);
            await node.Stacks.StopAsync("blue", default);
            await node.Stacks.PsAsync("blue", default);
            await node.Stacks.LogsAsync("blue", "catalog", 50, default);
            await node.Stacks.LogsAsync("blue", null, 200, default);
            Assert.IsNull(await node.Stacks.ReadMarkerAsync("blue", "tenantdb.carried", default));
            await node.Stacks.WriteMarkerAsync("blue", "tenantdb.carried", "once", default);
            Assert.AreEqual("once", await node.Stacks.ReadMarkerAsync("blue", "tenantdb.carried", default));
            await node.Stacks.DownAsync("blue", default);
            Assert.IsFalse(await node.Stacks.IsStampedAsync("blue", default));
        });
    }

    [TestMethod]
    public async Task Dumps_restores_and_volumes_stream_through_the_agent_with_the_same_commands()
    {
        await SameOnBothAsync(async node =>
        {
            using var dump = new MemoryStream();
            Assert.IsTrue((await node.Data.DumpDatabaseAsync("blue_catalogdb", dump, default)).Ok);
            Assert.IsTrue((await node.Data.RestoreDatabaseAsync("green_catalogdb", "green_app", new MemoryStream([1, 2, 3]), default)).Ok);
            using var archive = new MemoryStream();
            Assert.IsTrue((await node.Data.ExportVolumeAsync("ninja-blue_blue-branch-uploads", archive, default)).Ok);
            Assert.IsTrue((await node.Data.ImportVolumeAsync("ninja-green_green-branch-uploads", new MemoryStream([4, 5]), default)).Ok);
        });
    }

    [TestMethod]
    public async Task What_the_node_has_is_read_with_the_same_commands_through_the_agent()
    {
        await SameOnBothAsync(async node =>
        {
            await node.Capacity.ProbeAsync(default);
            await node.Images.RunningAsync(default);
            await node.Images.TaggedAsync(default);
        });
    }

    [TestMethod]
    public async Task The_broker_is_kept_with_the_same_rabbitmqctl_through_the_agent()
    {
        // The agent's broker is the dry run's: what it is asked is checked by name, the commands by the local side alone
        await _remote.Broker.EnsureUserAsync("blue", "secret", default);
        await _remote.Broker.EnsureVHostAsync("blue", "blue", default);
        await _remote.Broker.DeleteQueueAsync("blue", "catalog", default);
        await _remote.Broker.ClearPermissionsAsync("blue", "blue", default);
        await _remote.Broker.DeleteVHostAsync("blue", default);
        await _remote.Broker.DeleteUserAsync("blue", default);
        await _remote.Databases.EnsureRoleAsync("blue_app", "secret", default);
        await _remote.Databases.EnsureDatabaseAsync("blue_catalogdb", "blue_app", default);
        await _remote.Databases.LockDownAsync("controldb", default);
        await _remote.Databases.DropDatabaseAsync("blue_catalogdb", default);
        await _remote.Databases.DropRoleAsync("blue_app", default);
    }

    [TestMethod]
    public async Task What_docker_refuses_comes_back_as_the_same_exception_with_its_log()
    {
        await _remote.Stacks.WriteStackAsync("blue", Files, default);
        _failing!.FailOn = "up -d";
        _failing.Log = "pulling\nError response from daemon: manifest for ghcr.io/x:v9 not found";

        var refused = await Assert.ThrowsExactlyAsync<ShellException>(() => _remote.Stacks.UpAsync("blue", pull: false, default));
        Assert.AreEqual("manifest for ghcr.io/x:v9 not found", refused.Message, "the one line worth reading, as on the box");
        StringAssert.Contains(refused.Log, "pulling", "the whole log comes back for the step");

        _failing.FailOn = "pg_dump";
        _failing.Log = "pg_dump: database \"nope\" does not exist";
        var dump = await _remote.Data.DumpDatabaseAsync("nope", new MemoryStream(), default);
        Assert.AreEqual(1, dump.ExitCode);
        StringAssert.Contains(dump.Output, "does not exist");
    }

    [TestMethod]
    public async Task A_name_that_could_reach_a_command_line_badly_is_refused()
    {
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _remote.Stacks.UpAsync("blue;rm", pull: false, default));
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _remote.Stacks.ReadMarkerAsync("blue", "..", default));
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _remote.Databases.DropDatabaseAsync("Blue DB", default));
        Assert.IsFalse(_agentShell.Commands.Any(), "nothing ran");
    }

    [TestMethod]
    public void The_control_planes_own_stacks_are_what_a_node_runs()
    {
        // Every part on: the assistant, Talabat, push credentials, social sign-in, Google Maps
        var platform = new PlatformOptions
        {
            Domain = "ninja.app", GeminiApiKey = "k", EncryptionKey = "encryption-key-12345678901234567890",
            FirebaseCredentialsPath = "/opt/ninja/platform/firebase-credentials.json",
            Talabat = new TalabatOptions { MiddlewareUrl = "https://talabat.test", Username = "u", Password = "p", Secret = "s" },
        };
        var tenant = new Tenant
        {
            Slug = "blue", NameEn = "Blue", Kind = TenantKind.Customer, Plan = TenantPlan.Pro, ImageTag = "v1", OwnerEmail = "o@blue.test",
            SocialSignIn = true, GoogleMaps = true, IdentitySecret = "i", ControlSecret = "c", PaymentsKey = "p", DbPassword = "d", BrokerPassword = "b",
        };
        var compose = Templates.Compose(tenant, TenantHosts.For(tenant, platform), platform, new MapsSettings());
        var policy = new ComposePolicy(new AgentOptions().ImagePrefixes, new AgentOptions().BindSources);

        CollectionAssert.AreEqual(Array.Empty<string>(), policy.Check(compose).ToArray());
    }

    [TestMethod]
    public async Task A_compose_file_the_node_would_not_run_is_never_written()
    {
        var privileged = new StackFiles("services:\n  x:\n    image: \"ghcr.io/achmstein/ninja-catalog:v1\"\n    privileged: true\n", "");
        var foreign = new StackFiles("services:\n  x:\n    image: \"docker.io/evil/miner:latest\"\n", "");
        var socket = new StackFiles("services:\n  x:\n    image: \"ghcr.io/achmstein/ninja-catalog:v1\"\n    volumes:\n      - \"/var/run/docker.sock:/var/run/docker.sock\"\n", "");

        foreach (var files in new[] { privileged, foreign, socket })
        {
            var refused = await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _remote.Stacks.WriteStackAsync("blue", files, default));
            StringAssert.Contains(refused.Message, "422");
        }
        Assert.IsFalse(await _remote.Stacks.IsStampedAsync("blue", default));
    }
}
