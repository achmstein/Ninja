using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// What a node allows: its own settings where the record has them, the
/// platform's otherwise. Node 1 with nothing set is the platform as it always
/// was, so its room is counted exactly as before there were nodes.
/// </summary>
public sealed record NodeLimits(
    int ReserveMb,
    int StackFootprintMb,
    int PostgresMaxConnections,
    int PlatformConnections,
    int ServiceConnectionsEstimate,
    int MinFreeDiskMb,
    int? MaxStacks)
{
    public static NodeLimits For(Node? node, PlatformOptions platform) => new(
        node?.ReserveMb ?? platform.ReserveMb,
        node?.StackFootprintMb ?? platform.StackFootprintMb,
        node?.PostgresMaxConnections ?? platform.PostgresMaxConnections,
        node?.PlatformConnections ?? CapacityMath.PlatformConnections,
        platform.ServiceConnectionsEstimate,
        platform.MinFreeDiskMb,
        node?.MaxStacks);

    /// <summary>How many more stacks fit: the memory, the connection budget, the drive and the node's own cap, whichever says least.</summary>
    public int RoomFor(CapacitySnapshot snapshot)
    {
        var running = CapacityMath.RunningStacks(snapshot.Projects, snapshot.PlatformProject);
        var memory = CapacityMath.RoomFor(snapshot.MemAvailableMb, ReserveMb, StackFootprintMb);
        var connections = CapacityMath.ConnectionRoomFor(running, ServiceConnectionsEstimate, PostgresMaxConnections, PlatformConnections);
        var disk = CapacityMath.DiskRoom(snapshot.TenantsDiskFreeMb, snapshot.TenantsDiskTotalMb, MinFreeDiskMb, StackFootprintMb) ? int.MaxValue : 0;
        var capped = MaxStacks is int max ? Math.Max(0, max - running) : int.MaxValue;
        return Math.Min(Math.Min(memory, connections), Math.Min(disk, capped));
    }

    /// <summary>Why a stamp is refused, in words: the drive, the connections, the cap or the memory.</summary>
    public string WhyNoRoom(CapacitySnapshot snapshot)
    {
        if (!CapacityMath.DiskRoom(snapshot.TenantsDiskFreeMb, snapshot.TenantsDiskTotalMb, MinFreeDiskMb, StackFootprintMb))
            return $"{snapshot.TenantsDiskFreeMb} MB free on the tenants drive; the floor is {MinFreeDiskMb} MB and a stack needs room above it for its backups.";
        var stacks = CapacityMath.RunningStacks(snapshot.Projects, snapshot.PlatformProject);
        if (CapacityMath.ConnectionRoomFor(stacks, ServiceConnectionsEstimate, PostgresMaxConnections, PlatformConnections) == 0)
            return $"Postgres allows {PostgresMaxConnections} connections and the running stacks typically hold {CapacityMath.ConnectionsEstimate(stacks, ServiceConnectionsEstimate, PlatformConnections)}.";
        if (MaxStacks is int max && stacks >= max)
            return $"{stacks} stacks run here and the node takes no more than {max}.";
        return $"{snapshot.MemAvailableMb} MB free, {ReserveMb} MB kept for the shared services, {StackFootprintMb} MB per stack.";
    }
}

/// <summary>A node as placement weighs it: its record, its last reading, the room that leaves and how many tenants already live there.</summary>
public sealed record NodeCapacity(Node Node, CapacitySnapshot? Snapshot, int RoomFor, string? WhyNoRoom, int Placed);

/// <summary>What is being placed: a demo or a business, on a node asked for or wherever fits, and whether a full node will do.</summary>
public sealed record PlacementRequest(TenantKind Kind, int? PinnedNodeId = null, bool Force = false);

/// <summary>The node chosen, or none and why.</summary>
public sealed record PlacementDecision(int? NodeId, string Reason)
{
    public bool Placed => NodeId is not null;
}

/// <summary>Which node a new tenant goes to. Pure: the nodes and their room come in, a decision goes out.</summary>
public interface IPlacementPolicy
{
    PlacementDecision Place(PlacementRequest request, IReadOnlyList<NodeCapacity> nodes);
}

/// <summary>
/// Spread: an Active node, one labelled for the tenant's kind first when there
/// is one, with room unless forced; the most room, then the fewest tenants,
/// then the oldest node. A pinned node is taken as asked when it is Active, or
/// Cordoned and forced.
/// </summary>
public sealed class SpreadPlacement : IPlacementPolicy
{
    public PlacementDecision Place(PlacementRequest request, IReadOnlyList<NodeCapacity> nodes)
    {
        if (request.PinnedNodeId is int pinned)
        {
            var asked = nodes.FirstOrDefault(n => n.Node.Id == pinned);
            if (asked is null) return new(null, $"Node {pinned} is not on the record.");
            var usable = asked.Node.Status == NodeStatus.Active || (asked.Node.Status == NodeStatus.Cordoned && request.Force);
            if (!usable) return new(null, $"{asked.Node.Name} is {asked.Node.Status.ToString().ToLowerInvariant()} and takes no new tenants.");
            if (asked.RoomFor <= 0 && !request.Force) return new(null, $"{asked.Node.Name}: {asked.WhyNoRoom}");
            return new(asked.Node.Id, $"{asked.Node.Name}, as asked");
        }

        var active = nodes.Where(n => n.Node.Status == NodeStatus.Active).ToList();
        if (active.Count == 0) return new(null, "No node takes new tenants.");

        var label = request.Kind == TenantKind.Demo ? "demo" : "customer";
        var labelled = active.Where(n => n.Node.Labels.Contains(label, StringComparer.OrdinalIgnoreCase)).ToList();
        var pool = labelled.Count > 0 ? labelled : active;

        var withRoom = pool.Where(n => n.RoomFor > 0).ToList();
        if (withRoom.Count == 0 && !request.Force)
            return new(null, string.Join(" ", pool.Select(n => $"{n.Node.Name}: {n.WhyNoRoom}")));

        var chosen = (withRoom.Count > 0 ? withRoom : pool)
            .OrderByDescending(n => n.RoomFor)
            .ThenBy(n => n.Placed)
            .ThenBy(n => n.Node.Id)
            .First();
        return new(chosen.Node.Id, withRoom.Count > 0 ? $"{chosen.Node.Name}, room for {chosen.RoomFor} more" : $"{chosen.Node.Name}, forced past its room");
    }
}
