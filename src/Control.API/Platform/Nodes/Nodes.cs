using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The box a tenant's stack runs on, as the control plane sees it. Today there
/// is one, the box the control plane itself runs on (node 1); the plan for more
/// (docs/multi-server-plan.md) adds nodes reached through an agent, and nothing
/// that talks to a node needs to know which kind it has.
/// </summary>
public sealed record NodeRef(int Id, string Name);

/// <summary>
/// How the control plane reaches a stack's gateway: the address to send to and,
/// when that address serves more than one stack (another node's ingress), the
/// host to ask it for.
/// </summary>
public sealed record StackRoute(Uri BaseAddress, string? Host = null);

/// <summary>One node, its parts each behind its own interface.</summary>
public interface INodeClient
{
    NodeRef Node { get; }

    /// <summary>The shared services as this node's stacks reach them, stamped into their compose files.</summary>
    NodeEndpoints Endpoints { get; }

    IStackRuntime Stacks { get; }

    INodeData Data { get; }

    /// <summary>The node's Postgres: the tenants' roles and databases.</summary>
    IDatabaseAdmin Databases { get; }

    /// <summary>The node's broker: the tenants' users, vhosts and queues.</summary>
    IBrokerAdmin Broker { get; }

    /// <summary>What the node has and what its stacks take.</summary>
    IHostCapacity Capacity { get; }

    IImageInventory Images { get; }

    /// <summary>Where the control plane reaches this tenant's gateway.</summary>
    StackRoute RouteTo(string slug);
}

/// <summary>Which node a tenant lives on, and the way to it.</summary>
public interface INodes
{
    INodeClient For(Tenant tenant);

    INodeClient For(int nodeId);

    /// <summary>The nodes on the record, as last read; empty before the first read.</summary>
    IReadOnlyList<Node> Known { get; }

    /// <summary>The box the control plane runs on, with the platform's own databases (controldb, keycloak).</summary>
    INodeClient Home { get; }
}

/// <summary>Every tenant on the one box the control plane runs on: the platform as it is until a second node joins.</summary>
public sealed class SingleNode(LocalNodeClient local) : INodes
{
    public INodeClient For(Tenant tenant) => local;

    public INodeClient For(int nodeId) => local;

    public IReadOnlyList<Node> Known => [];

    public INodeClient Home => local;
}
