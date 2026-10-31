using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.API.Platform;

/// <summary>Dry run: a 16 GB box with a stack's worth of memory taken per Running tenant.</summary>
public sealed class DryRunHostCapacity(IServiceScopeFactory scopes, IOptions<PlatformOptions> options) : IHostCapacity
{
    public async Task<CapacitySnapshot> ProbeAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
        var running = await context.Tenants.AsNoTracking().Where(t => t.Status == TenantStatus.Running).Select(t => t.Slug).ToListAsync(ct);
        var perStack = (long)(options.Value.StackFootprintMb * 0.9);
        var projects = running.Select(slug => new ProjectUsage(TenantNaming.Project(slug), TenantNaming.Services.Length + 1, TenantNaming.Services.Length + 1, perStack, 4.2)).ToList();
        var total = 16 * 1024L;
        var used = 2 * 1024L + running.Count * perStack;
        return new CapacitySnapshot(DateTimeOffset.UtcNow, total, Math.Max(0, total - used), [0.42, 0.51, 0.47], 4,
            120 * 1024L, 250 * 1024L, 9 * 1024L, 1 * 1024L, projects);
    }
}

/// <summary>
/// Each node's last reading, refreshed on a timer so the control app can poll
/// without probing a box each time. What callers knew as "the box" is node 1,
/// the box the control plane runs on, where every tenant lives until a second
/// node joins.
/// </summary>
public sealed class CapacityCache(INodes nodes, IOptions<PlatformOptions> options)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ConcurrentDictionary<int, CapacitySnapshot> _byNode = new();

    /// <summary>The box the control plane runs on, as last read.</summary>
    public CapacitySnapshot? Latest => For(Node.HomeId);

    /// <summary>A node as last read; none before its first reading.</summary>
    public CapacitySnapshot? For(int nodeId) => _byNode.GetValueOrDefault(nodeId);

    /// <summary>The box the control plane runs on, read now.</summary>
    public async Task<CapacitySnapshot> RefreshAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var snapshot = await nodes.Home.Capacity.ProbeAsync(ct);
            // Every node that is this box reads the same: the record may name the box more than once only by mistake, but it stays consistent
            foreach (var node in nodes.Known.Where(n => n.Kind == NodeKind.Local).Select(n => n.Id).Append(Node.HomeId).Distinct())
                _byNode[node] = snapshot;
            return snapshot;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>The cached snapshot, or a fresh one when there is none yet.</summary>
    public async Task<CapacitySnapshot> GetAsync(bool refresh, CancellationToken ct)
        => Latest is { } latest && !refresh ? latest : await RefreshAsync(ct);

    /// <summary>What a node allows: its own settings, the platform's where it has none.</summary>
    public NodeLimits LimitsFor(int nodeId) => NodeLimits.For(nodes.Known.FirstOrDefault(n => n.Id == nodeId), options.Value);

    /// <summary>How many more stacks fit on the box the control plane runs on.</summary>
    public int RoomFor(CapacitySnapshot snapshot) => LimitsFor(Node.HomeId).RoomFor(snapshot);

    /// <summary>Why a stamp is refused on the box the control plane runs on, in words.</summary>
    public string WhyNoRoom(CapacitySnapshot snapshot) => LimitsFor(Node.HomeId).WhyNoRoom(snapshot);

    /// <summary>
    /// Every node on the record as placement weighs it, with how many live tenants each holds. A node never read
    /// counts as having room: better a stamp than a guess, as before there were nodes.
    /// </summary>
    public IReadOnlyList<NodeCapacity> Weigh(IReadOnlyDictionary<int, int> placed)
    {
        var known = nodes.Known.Count > 0 ? nodes.Known : [new Node { Id = Node.HomeId, Name = "node-1", Kind = NodeKind.Local }];
        return known.Select(node =>
        {
            var snapshot = For(node.Id);
            var limits = NodeLimits.For(node, options.Value);
            var room = snapshot is null ? int.MaxValue : limits.RoomFor(snapshot);
            return new NodeCapacity(node, snapshot, room, snapshot is null || room > 0 ? null : limits.WhyNoRoom(snapshot), placed.GetValueOrDefault(node.Id));
        }).ToList();
    }

    /// <summary>Whether another stack fits on the box the control plane runs on, on its last reading; true when it has never been read.</summary>
    public bool HasRoom => HasRoomOn(Node.HomeId);

    /// <summary>Whether another stack fits on a node, on its last reading; true when it has never been read.</summary>
    public bool HasRoomOn(int nodeId) => For(nodeId) is not { } snapshot || LimitsFor(nodeId).RoomFor(snapshot) > 0;

    /// <summary>Why a node takes no more stacks, in words; empty when it has never been read.</summary>
    public string WhyNoRoomOn(int nodeId) => For(nodeId) is { } snapshot ? LimitsFor(nodeId).WhyNoRoom(snapshot) : "the node has not been read yet.";
}

public sealed class CapacityMonitor(CapacityCache cache, IOptions<PlatformOptions> options, ILogger<CapacityMonitor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, options.Value.CapacityRefreshSeconds)));
        do
        {
            try
            {
                await cache.RefreshAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Could not read the box's capacity");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
