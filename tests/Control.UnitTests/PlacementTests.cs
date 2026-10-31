using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.UnitTests;

/// <summary>Where a new tenant goes, and how much a node takes: pure, on nodes and readings made up here.</summary>
[TestClass]
public sealed class PlacementTests
{
    private static readonly SpreadPlacement Policy = new();

    private static NodeCapacity N(int id, int room, NodeStatus status = NodeStatus.Active, int placed = 0, params string[] labels)
        => new(new Node { Id = id, Name = $"node-{id}", Status = status, Labels = [.. labels] }, null, room, room > 0 ? null : "full", placed);

    [TestMethod]
    public void The_node_with_the_most_room_takes_it()
    {
        var decision = Policy.Place(new(TenantKind.Customer), [N(1, 2), N(2, 5), N(3, 4)]);
        Assert.AreEqual(2, decision.NodeId);
    }

    [TestMethod]
    public void Room_level_the_emptier_node_then_the_older_one_takes_it()
    {
        Assert.AreEqual(2, Policy.Place(new(TenantKind.Customer), [N(1, 3, placed: 4), N(2, 3, placed: 1)]).NodeId);
        Assert.AreEqual(1, Policy.Place(new(TenantKind.Customer), [N(1, 3, placed: 1), N(2, 3, placed: 1)]).NodeId);
    }

    [TestMethod]
    public void A_node_labelled_for_the_kind_comes_first_even_with_less_room()
    {
        var nodes = new[] { N(1, 9), N(2, 1, labels: "demo") };
        Assert.AreEqual(2, Policy.Place(new(TenantKind.Demo), nodes).NodeId);
        Assert.AreEqual(1, Policy.Place(new(TenantKind.Customer), nodes).NodeId, "no customer node: any active one");
    }

    [TestMethod]
    public void Cordoned_draining_and_unreachable_nodes_take_no_new_tenants()
    {
        var decision = Policy.Place(new(TenantKind.Customer), [N(1, 9, NodeStatus.Cordoned), N(2, 9, NodeStatus.Draining), N(3, 9, NodeStatus.Unreachable)]);
        Assert.IsFalse(decision.Placed);
        StringAssert.Contains(decision.Reason, "No node takes new tenants");
    }

    [TestMethod]
    public void Full_everywhere_is_refused_with_each_nodes_reason_unless_forced()
    {
        var nodes = new[] { N(1, 0), N(2, 0) };
        var refused = Policy.Place(new(TenantKind.Customer), nodes);
        Assert.IsFalse(refused.Placed);
        StringAssert.Contains(refused.Reason, "node-1: full");
        StringAssert.Contains(refused.Reason, "node-2: full");

        Assert.AreEqual(1, Policy.Place(new(TenantKind.Customer, Force: true), nodes).NodeId);
    }

    [TestMethod]
    public void A_pinned_node_is_taken_as_asked_while_it_may_be()
    {
        var nodes = new[] { N(1, 9), N(2, 1), N(3, 9, NodeStatus.Cordoned), N(4, 0) };
        Assert.AreEqual(2, Policy.Place(new(TenantKind.Customer, PinnedNodeId: 2), nodes).NodeId);
        Assert.IsFalse(Policy.Place(new(TenantKind.Customer, PinnedNodeId: 3), nodes).Placed, "cordoned");
        Assert.AreEqual(3, Policy.Place(new(TenantKind.Customer, PinnedNodeId: 3, Force: true), nodes).NodeId, "cordoned, forced");
        Assert.IsFalse(Policy.Place(new(TenantKind.Customer, PinnedNodeId: 4), nodes).Placed, "full");
        Assert.IsFalse(Policy.Place(new(TenantKind.Customer, PinnedNodeId: 9), nodes).Placed, "not on the record");
    }

    private static CapacitySnapshot Box(long availableMb, int running) => new(
        DateTimeOffset.UtcNow, 16 * 1024, availableMb, [0.1, 0.1, 0.1], 4, 100 * 1024, 200 * 1024, 0, 0,
        [.. Enumerable.Range(0, running).Select(i => new ProjectUsage($"ninja-t{i}", 12, 12, 2048, 1))]);

    [TestMethod]
    public void A_node_with_nothing_set_counts_its_room_as_the_platform_always_has()
    {
        var platform = new PlatformOptions { ReserveMb = 1024, StackFootprintMb = 2048 };
        var limits = NodeLimits.For(null, platform);
        var box = Box(availableMb: 9 * 1024, running: 2);

        Assert.AreEqual(4, limits.RoomFor(box), "(9 GB - 1 GB) / 2 GB");
        Assert.AreEqual(CapacityMath.RoomFor(box.MemAvailableMb, 1024, 2048), limits.RoomFor(box));
        Assert.AreEqual(NodeLimits.For(new Node(), platform), limits);
    }

    [TestMethod]
    public void A_nodes_own_settings_and_cap_count_over_the_platforms()
    {
        var platform = new PlatformOptions { ReserveMb = 1024, StackFootprintMb = 2048 };
        var box = Box(availableMb: 9 * 1024, running: 2);

        Assert.AreEqual(8, NodeLimits.For(new Node { StackFootprintMb = 1024, PostgresMaxConnections = 2000 }, platform).RoomFor(box), "(9 - 1) / 1, connections to spare");
        Assert.AreEqual(6, NodeLimits.For(new Node { StackFootprintMb = 1024 }, platform).RoomFor(box), "(400 - 40 - 2 × 44) / 44: the connections say less than the memory");
        var capped = NodeLimits.For(new Node { MaxStacks = 3 }, platform);
        Assert.AreEqual(1, capped.RoomFor(box), "3 allowed, 2 running");
        Assert.AreEqual(0, NodeLimits.For(new Node { MaxStacks = 2 }, platform).RoomFor(box));
        StringAssert.Contains(NodeLimits.For(new Node { MaxStacks = 2 }, platform).WhyNoRoom(box), "no more than 2");
    }

    [TestMethod]
    public void A_node_whose_postgres_is_its_own_spends_its_connections_on_stacks()
    {
        var platform = new PlatformOptions { ReserveMb = 0, StackFootprintMb = 1, PostgresMaxConnections = 400, ServiceConnectionsEstimate = 4 };
        var box = Box(availableMb: 64 * 1024, running: 0);

        // 44 a stack: (400 - 40) / 44 with the platform's databases beside them, (400 - 5) / 44 on a node of its own
        Assert.AreEqual(8, NodeLimits.For(null, platform).RoomFor(box));
        Assert.AreEqual(8, NodeLimits.For(new Node { PlatformConnections = 5 }, platform).RoomFor(box));
        Assert.AreEqual(18, NodeLimits.For(new Node { PlatformConnections = 5, PostgresMaxConnections = 800 }, platform).RoomFor(box));
    }
}
