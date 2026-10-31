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

    /// <summary>This box answers as an agent would: the API version it speaks, its architecture, whether its docker does.</summary>
    public async Task<AgentPing> PingAsync(CancellationToken ct)
    {
        var docker = await shell.RunAsync("docker", ["version", "--format", "{{.Server.Version}}"], null, ct);
        var arch = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture == System.Runtime.InteropServices.Architecture.Arm64 ? "arm64" : "amd64";
        return new AgentPing(AgentApi.Version, arch, docker.Ok, docker.Ok ? null : docker.Output);
    }
}

