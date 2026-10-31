using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>Places a new tenant: every node's room and how many live tenants it holds, weighed by the policy.</summary>
public sealed class Placement(ControlContext context, CapacityCache capacity, IPlacementPolicy policy)
{
    public async Task<PlacementDecision> PlaceAsync(PlacementRequest request, CancellationToken ct)
    {
        var placed = await context.Tenants.AsNoTracking()
            .Where(t => t.Status != TenantStatus.Destroyed)
            .GroupBy(t => t.NodeId)
            .Select(g => new { Node = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Node, g => g.Count, ct);
        return policy.Place(request, capacity.Weigh(placed));
    }
}
