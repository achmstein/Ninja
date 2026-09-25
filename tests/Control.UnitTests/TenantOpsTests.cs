using System.Text.Json.Nodes;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class TenantOpsTests
{
    [TestMethod]
    public void Compose_ps_reads_the_array_newer_compose_prints_and_the_lines_older_compose_printed()
    {
        const string array = """[{"Name":"ninja-blue-blue-catalog-api-1","Service":"blue-catalog-api","State":"running","Health":"healthy","Status":"Up 2 hours (healthy)","Image":"ghcr.io/x/ninja-catalog:latest","ExitCode":0},{"Name":"ninja-blue-blue-gateway-1","Service":"blue-gateway","State":"exited","Health":"","Status":"Exited (1) 3 minutes ago","ExitCode":1}]""";
        var fromArray = ComposePs.Parse(array);
        Assert.AreEqual(2, fromArray.Count);
        Assert.AreEqual("blue-catalog-api", fromArray[0].Service);
        Assert.AreEqual("healthy", fromArray[0].Health);
        Assert.AreEqual("ghcr.io/x/ninja-catalog:latest", fromArray[0].Image);
        Assert.IsNull(fromArray[1].Health, "an empty health is none");
        Assert.AreEqual(1, fromArray[1].ExitCode);

        const string lines = """{"Name":"a","Service":"blue-sales-api","State":"running","Status":"Up"}""" + "\n" + "garbage\n" + """{"Name":"b","Service":"blue-tenant-api","State":"running","Status":"Up"}""" + "\n";
        var fromLines = ComposePs.Parse(lines);
        CollectionAssert.AreEqual(new[] { "blue-sales-api", "blue-tenant-api" }, fromLines.Select(c => c.Service).ToList());

        Assert.AreEqual(0, ComposePs.Parse("  ").Count);
    }

    [TestMethod]
    public void Metrics_add_the_branches_up_and_keep_the_top_items_by_units()
    {
        var branch1 = JsonNode.Parse("""{"days":[{"date":"2026-09-18","orders":10,"revenue":500.5},{"date":"2026-09-19","orders":4,"revenue":120}],"topItems":[{"productName":{"en":"Latte","ar":"لاتيه"},"units":30,"revenue":1500},{"productName":{"en":"Tea"},"units":12,"revenue":240}]}""")!.AsObject();
        var branch2 = JsonNode.Parse("""{"days":[{"date":"2026-09-19","orders":6,"revenue":300}],"topItems":[{"productName":{"en":"Tea"},"units":20,"revenue":400}]}""")!.AsObject();
        var report1 = JsonNode.Parse("""{"ticketsSettled":15,"net":1200.75}""")!.AsObject();
        var report2 = JsonNode.Parse("""{"ticketsSettled":5,"net":400}""")!.AsObject();
        var profit = JsonNode.Parse("""{"netSales":9000,"profit":2500.5}""")!.AsObject();
        var loyalty = JsonNode.Parse("""{"totalAccounts":321}""")!.AsObject();

        var m = TenantMetricsMath.Merge(7, 2, [branch1, branch2], [report1, report2], profit, loyalty, ["finance answered 500"]);

        Assert.AreEqual(20, m.Orders);
        Assert.AreEqual(920.5m, m.Revenue);
        Assert.AreEqual(20, m.TicketsSettled);
        Assert.AreEqual(1600.75m, m.NetSales);
        Assert.AreEqual(2500.5m, m.MonthProfit);
        Assert.AreEqual(321, m.LoyaltyAccounts);
        Assert.AreEqual(2, m.Series.Count);
        Assert.AreEqual(new DateOnly(2026, 9, 19), m.Series[1].Date);
        Assert.AreEqual(10, m.Series[1].Orders, "both branches' orders on the same day");
        Assert.AreEqual("Tea", m.TopItems[0].Name, "Tea sold 32 units across the branches, more than the 30 lattes");
        Assert.AreEqual(32, m.TopItems[0].Units);
        Assert.AreEqual(1, m.Warnings.Count);
    }

    [TestMethod]
    public void Metrics_stand_without_the_services_that_did_not_answer()
    {
        var m = TenantMetricsMath.Merge(30, 0, [], [], null, null, ["/api/branches/all did not answer"]);
        Assert.AreEqual(0, m.Orders);
        Assert.IsNull(m.MonthProfit);
        Assert.AreEqual(0, m.Series.Count);
    }
}
