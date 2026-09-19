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
}
