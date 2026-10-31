using System.Globalization;
using Microsoft.Extensions.Options;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The box the control plane runs on: its docker through the shell, its
/// tenants' folders under <see cref="PlatformOptions.TenantsRoot"/>. A node
/// agent on another box runs the same parts (Ninja.Control.NodeRuntime) against its own docker.
/// </summary>
public sealed class LocalNodeClient(IShell shell, IOptions<PlatformOptions> options, IDatabaseAdmin databases, IBrokerAdmin broker, IHostCapacity capacity) : INodeClient
{
    public NodeRef Node { get; } = new(1, "node-1");

    public NodeEndpoints Endpoints => NodeEndpoints.From(options.Value);

    public IStackRuntime Stacks { get; } = new LocalStackRuntime(shell, new PlatformNodeSettings(options));

    public INodeData Data { get; } = new LocalNodeData(shell, new PlatformNodeSettings(options));

    public IDatabaseAdmin Databases => databases;

    public IBrokerAdmin Broker => broker;

    public IHostCapacity Capacity => capacity;

    public IImageInventory Images { get; } = new LocalImageInventory(shell);

    /// <summary>The gateway by its container name, on the docker network the control plane shares with the stacks.</summary>
    public StackRoute RouteTo(string slug) => new(new Uri($"http://{TenantNaming.Gateway(slug)}:5000"));
}

