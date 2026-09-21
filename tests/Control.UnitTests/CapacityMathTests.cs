using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class CapacityMathTests
{
    [TestMethod]
    public void Meminfo_and_loadavg_read_as_the_kernel_prints_them()
    {
        var (total, available) = CapacityMath.ParseMeminfo("MemTotal:       16326884 kB\nMemFree:         1234567 kB\nMemAvailable:    9216000 kB\nBuffers:          123 kB\n");
        Assert.AreEqual(15944, total);
        Assert.AreEqual(9000, available);

        CollectionAssert.AreEqual(new[] { 0.52, 0.58, 0.59 }, CapacityMath.ParseLoadAvg("0.52 0.58 0.59 1/1234 5678\n"));
        CollectionAssert.AreEqual(new[] { 0d, 0d, 0d }, CapacityMath.ParseLoadAvg(""));
        Assert.AreEqual((0L, 0L), CapacityMath.ParseMeminfo(""));
    }

    [TestMethod]
    [DataRow("1.5GiB", 1536L)]
    [DataRow("512MB", 488L)]
    [DataRow("3.2kB", 0L)]
    [DataRow("0B", 0L)]
    [DataRow("1.2GB (40%)", 1144L)]
    [DataRow("120MiB / 15.6GiB", 120L)]
    [DataRow("garbage", 0L)]
    public void Docker_sizes_read_in_every_unit_it_prints(string text, long mb)
        => Assert.AreEqual(mb, CapacityMath.ParseDockerSizeMb(text));

    [TestMethod]
    public void Containers_group_by_compose_project_and_join_their_stats_by_name()
    {
        var ps = "ninja-blue-blue-catalog-api-1\tninja-blue\trunning\n" +
                 "ninja-blue-blue-gateway-1\tninja-blue\trunning\n" +
                 "ninja-blue-blue-sales-api-1\tninja-blue\texited\n" +
                 "ninja-postgres-1\tninja\trunning\n" +
                 "stray\t\trunning\n";
        var stats = """{"Name":"ninja-blue-blue-catalog-api-1","CPUPerc":"1.25%","MemUsage":"150MiB / 15.6GiB"}""" + "\n" +
                    """{"Name":"ninja-blue-blue-gateway-1","CPUPerc":"0.30%","MemUsage":"64MiB / 15.6GiB"}""" + "\n" +
                    "not json\n" +
                    """{"Name":"ninja-postgres-1","CPUPerc":"2%","MemUsage":"1.2GiB / 15.6GiB"}""" + "\n";

        var usage = CapacityMath.Group(ps, stats);

        Assert.AreEqual(2, usage.Count);
        var blue = usage.Single(u => u.Project == "ninja-blue");
        Assert.AreEqual(3, blue.Containers);
        Assert.AreEqual(2, blue.Running);
        Assert.AreEqual(214, blue.MemoryMb);
        Assert.AreEqual(1.6, blue.CpuPercent, 0.01);
        var platform = usage.Single(u => u.Project == "ninja");
        Assert.AreEqual(1229, platform.MemoryMb);
    }

    [TestMethod]
    public void Room_is_what_is_free_beyond_the_reserve_in_footprints()
    {
        Assert.AreEqual(3, CapacityMath.RoomFor(availableMb: 8000, reserveMb: 1024, footprintMb: 2048));
        Assert.AreEqual(0, CapacityMath.RoomFor(availableMb: 2500, reserveMb: 1024, footprintMb: 2048));
        Assert.AreEqual(0, CapacityMath.RoomFor(availableMb: 500, reserveMb: 1024, footprintMb: 2048), "never negative");
        Assert.AreEqual(0, CapacityMath.RoomFor(availableMb: 8000, reserveMb: 0, footprintMb: 0), "a zero footprint means no guard, not infinity");
    }

    [TestMethod]
    public void Connections_are_counted_per_running_stack_and_the_drive_has_a_floor()
    {
        Assert.AreEqual(40, CapacityMath.ConnectionsEstimate(runningStacks: 0, perService: 4));
        Assert.AreEqual(40 + 3 * 11 * 4, CapacityMath.ConnectionsEstimate(runningStacks: 3, perService: 4));
        Assert.AreEqual(8, CapacityMath.ConnectionRoomFor(runningStacks: 0, perService: 4, maxConnections: 400), "400 takes eight stacks of 44 beyond the platform's 40");
        Assert.AreEqual(0, CapacityMath.ConnectionRoomFor(runningStacks: 8, perService: 4, maxConnections: 400));
        Assert.AreEqual(0, CapacityMath.ConnectionRoomFor(runningStacks: 0, perService: 0, maxConnections: 400), "a zero estimate means no guard");

        Assert.IsTrue(CapacityMath.DiskRoom(freeMb: 6000, totalMb: 100_000, floorMb: 5120, footprintMb: 2048));
        Assert.IsFalse(CapacityMath.DiskRoom(freeMb: 5200, totalMb: 100_000, floorMb: 5120, footprintMb: 2048), "just above the floor is not room for a stack's backups");
        Assert.IsTrue(CapacityMath.DiskRoom(freeMb: 0, totalMb: 0, floorMb: 5120, footprintMb: 2048), "a drive never read does not block");

        var projects = new List<ProjectUsage> { new("ninja-blue", 13, 13, 1800, 4), new("ninja-red", 13, 0, 0, 0), new("ninja", 5, 5, 3000, 6) };
        Assert.AreEqual(1, CapacityMath.RunningStacks(projects), "a stopped stack and the platform's own project do not count");
    }

    [TestMethod]
    public void The_reconciler_names_a_running_record_without_containers_and_a_project_without_a_record()
    {
        var records = new List<(string, Ninja.Control.API.Model.TenantStatus)>
        {
            ("blue", Ninja.Control.API.Model.TenantStatus.Running),
            ("red", Ninja.Control.API.Model.TenantStatus.Running),
            ("green", Ninja.Control.API.Model.TenantStatus.Stopped),
            ("old", Ninja.Control.API.Model.TenantStatus.Destroyed),
        };
        var projects = new List<ProjectUsage> { new("ninja-blue", 13, 13, 1800, 4), new("ninja-green", 13, 0, 0, 0), new("ninja-old", 13, 13, 1800, 4), new("ninja-stray", 2, 2, 100, 1), new("ninja", 5, 5, 3000, 6) };

        var (down, orphans) = Reconciler.Compare(records, projects);

        CollectionAssert.AreEqual(new[] { "red" }, down.ToList(), "red is Running on the record with no project; green is Stopped, so its idle project is fine");
        CollectionAssert.AreEqual(new[] { "ninja-old", "ninja-stray" }, orphans.ToList(), "a destroyed record does not explain a project; the platform's own is not a stack");

        var now = DateTimeOffset.UtcNow;
        Assert.IsTrue(WorkerHealthCheck.IsAlive(now.AddSeconds(-30), now));
        Assert.IsFalse(WorkerHealthCheck.IsAlive(now.AddMinutes(-3), now));
        Assert.IsFalse(WorkerHealthCheck.IsAlive(null, now));
    }
}
