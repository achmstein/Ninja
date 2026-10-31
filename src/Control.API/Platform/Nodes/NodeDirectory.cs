using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The nodes on the record, and the way to each. Read from the database at
/// start and after every change to a node (<see cref="RefreshAsync"/>), so the
/// many calls that only need a tenant's node never wait on a query. Node 1, the
/// box the control plane runs on, is answered before the first read too: every
/// tenant lived there before there were nodes.
/// </summary>
public sealed class NodeDirectory(LocalNodeClient local, AgentConnections agents, IServiceScopeFactory scopes, ILogger<NodeDirectory> logger) : INodes
{
    private volatile IReadOnlyList<Node> _nodes = [];

    /// <summary>The nodes as last read, by id.</summary>
    public IReadOnlyList<Node> Known => _nodes;

    public INodeClient Home => local;

    public INodeClient For(Tenant tenant) => For(tenant.NodeId);

    public INodeClient For(int nodeId)
    {
        if (nodeId == Node.HomeId) return local;
        var node = _nodes.FirstOrDefault(n => n.Id == nodeId)
            ?? throw new InvalidOperationException($"Node {nodeId} is not on the record.");
        return node.Kind switch
        {
            NodeKind.Local => local,
            _ => agents.For(node),
        };
    }

    public Node? Find(int nodeId) => _nodes.FirstOrDefault(n => n.Id == nodeId);

    public async Task RefreshAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        _nodes = await context.Nodes.AsNoTracking().OrderBy(n => n.Id).ToListAsync(ct);
        logger.LogDebug("{Count} node(s) on the record", _nodes.Count);
    }
}

/// <summary>Reads the nodes once the database is there; the directory answers for node 1 until then.</summary>
public sealed class NodeDirectoryLoader(NodeDirectory directory, ILogger<NodeDirectoryLoader> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // The migrations run at start too: try a few times rather than once
        for (var attempt = 1; attempt <= 10 && !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                await directory.RefreshAsync(stoppingToken);
                return;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Could not read the nodes (attempt {Attempt})", attempt);
                await Task.Delay(TimeSpan.FromSeconds(3 * attempt), stoppingToken);
            }
        }
    }
}
