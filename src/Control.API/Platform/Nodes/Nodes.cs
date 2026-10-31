using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The box a tenant's stack runs on, as the control plane sees it. Today there
/// is one, the box the control plane itself runs on (node 1); the plan for more
/// (docs/multi-server-plan.md) adds nodes reached through an agent, and nothing
/// that talks to a node needs to know which kind it has.
/// </summary>
public sealed record NodeRef(int Id, string Name);

/// <summary>What a stack is stamped from: its compose file and its secrets.</summary>
public sealed record StackFiles(string Compose, string Env);

/// <summary>
/// A tenant's stack on its node: its files, and docker compose against its
/// project. Every call is idempotent the way compose is, and a command docker
/// refuses throws <see cref="ShellException"/> with what docker said.
/// </summary>
public interface IStackRuntime
{
    /// <summary>The compose file and the .env (readable by the owner only) written in the stack's folder.</summary>
    Task WriteStackAsync(string slug, StackFiles files, CancellationToken ct);

    /// <summary>Whether the stack was ever stamped here: its folder is on the node.</summary>
    Task<bool> IsStampedAsync(string slug, CancellationToken ct);

    /// <summary>Up, taking the orphans with it; pulling every image first when asked.</summary>
    Task<string> UpAsync(string slug, bool pull, CancellationToken ct);

    Task<string> StopAsync(string slug, CancellationToken ct);

    /// <summary>Down with its volumes, then the stack's folder gone.</summary>
    Task<string> DownAsync(string slug, CancellationToken ct);

    Task<IReadOnlyList<ContainerInfo>> PsAsync(string slug, CancellationToken ct);

    /// <summary>The last lines of one compose service's log, or of the whole stack's.</summary>
    Task<string> LogsAsync(string slug, string? service, int tail, CancellationToken ct);

    /// <summary>A note kept in the stack's folder that a one-time step ran (a carry, the demo data); null when it never did.</summary>
    Task<string?> ReadMarkerAsync(string slug, string name, CancellationToken ct);

    Task WriteMarkerAsync(string slug, string name, string content, CancellationToken ct);
}

/// <summary>
/// A node's data: its Postgres and its docker volumes, streamed in and out.
/// What the command said comes back as it is, for the caller to put in its
/// own words; nothing here throws for a command that failed.
/// </summary>
public interface INodeData
{
    /// <summary>One database in Postgres's custom format, as the superuser.</summary>
    Task<ShellResult> DumpDatabaseAsync(string database, Stream output, CancellationToken ct);

    /// <summary>A custom-format dump into one database, replacing what is there, its tables owned by <paramref name="role"/>.</summary>
    Task<ShellResult> RestoreDatabaseAsync(string database, string role, Stream input, CancellationToken ct);

    /// <summary>A volume's files as a gzipped tar; fails when the volume is not there.</summary>
    Task<ShellResult> ExportVolumeAsync(string volume, Stream output, CancellationToken ct);

    /// <summary>A gzipped tar unpacked into a volume, made when it is not there.</summary>
    Task<ShellResult> ImportVolumeAsync(string volume, Stream input, CancellationToken ct);
}

/// <summary>One node, its parts each behind its own interface.</summary>
public interface INodeClient
{
    NodeRef Node { get; }

    /// <summary>The shared services as this node's stacks reach them, stamped into their compose files.</summary>
    NodeEndpoints Endpoints { get; }

    IStackRuntime Stacks { get; }

    INodeData Data { get; }
}

/// <summary>Which node a tenant lives on, and the way to it.</summary>
public interface INodes
{
    INodeClient For(Tenant tenant);

    /// <summary>The box the control plane runs on, with the platform's own databases (controldb, keycloak).</summary>
    INodeClient Home { get; }
}

/// <summary>Every tenant on the one box the control plane runs on: the platform as it is until a second node joins.</summary>
public sealed class SingleNode(LocalNodeClient local) : INodes
{
    public INodeClient For(Tenant tenant) => local;

    public INodeClient Home => local;

    /// <summary>The one box, reached through <paramref name="shell"/>: the tests' and the dry run's way to a node.</summary>
    public static SingleNode Over(IShell shell, IOptions<PlatformOptions> options) => new(new LocalNodeClient(shell, options));
}
