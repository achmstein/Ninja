using System.Net;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class StockReadToolsTests
{
    private static StockReadTools Tools(Bench bench) => new(bench.Tenant, bench.Api, bench.Clock);

    [TestMethod]
    public async Task Movements_name_the_item_and_type_and_go_out_with_the_branch_and_its_business_day()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/items", _ => new object[]
        {
            new { id = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", isActive = true },
            new { id = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", isActive = true },
        });
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/movements", _ => new
        {
            items = new[]
            {
                new { id = 5, stockItemId = 12, stockItemName = new { en = "Milk", ar = "لبن" }, unit = "ml", type = "Waste", quantity = -500m, unitCost = 0.05m, reference = (string?)null, reason = "Spilled", recordedBy = "Mona", recordedAt = new DateTime(2026, 9, 22, 9, 30, 0, DateTimeKind.Utc) },
            },
            totalCount = 3,
        });

        var result = await Tools(bench).GetStockMovements("لبن", "waste", "today", null, null, "Maadi", 1, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var call = bench.Handler.Requests.Single(q => q.Url.AbsolutePath == "/api/inventory/movements");
        Assert.AreEqual("2", call.Branch);
        StringAssert.Contains(call.Url.Query, "stockItemId=12");
        StringAssert.Contains(call.Url.Query, "type=Waste");
        StringAssert.Contains(call.Url.Query, "from=2026-09-21T21:00:00Z");
        StringAssert.Contains(call.Url.Query, "pageSize=1");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(3, json.GetProperty("movements").GetInt32());
        var row = json.GetProperty("rows")[0];
        Assert.AreEqual("لبن", row.GetProperty("itemAr").GetString());
        Assert.AreEqual(-25m, row.GetProperty("value").GetDecimal());
        Assert.AreEqual("2026-09-22 12:30", row.GetProperty("at").GetString(), "in Cairo time");
        StringAssert.Contains(json.GetProperty("note").GetString(), "Only the newest 1 of 3");

        var badType = await Tools(bench).GetStockMovements(null, "stolen", "today", null, null, null, 10, CancellationToken.None);
        Assert.IsTrue(badType.IsError);
    }

    [TestMethod]
    public async Task Purchases_keep_to_the_period_and_total_by_supplier()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/purchases", _ => new
        {
            items = new object[]
            {
                new { id = 9, branchId = 2, supplier = "Dairy Co", invoiceRef = "D-1", receivedBy = "Mona", receivedAt = new DateTime(2026, 9, 20, 8, 0, 0, DateTimeKind.Utc), total = 300m,
                      lines = new[] { new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 10000m, unitCost = 0.03m, total = 300m } } },
                new { id = 8, branchId = 2, supplier = "Dairy Co", invoiceRef = "D-0", receivedBy = "Mona", receivedAt = new DateTime(2026, 9, 2, 8, 0, 0, DateTimeKind.Utc), total = 200m, lines = Array.Empty<object>() },
                new { id = 7, branchId = 2, supplier = "Roaster", invoiceRef = (string?)null, receivedBy = "Ali", receivedAt = new DateTime(2026, 8, 28, 8, 0, 0, DateTimeKind.Utc), total = 900m, lines = Array.Empty<object>() },
            },
            totalCount = 3,
        });

        var result = await Tools(bench).GetPurchases("this_month", null, null, "2", 10, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        StringAssert.Contains(bench.Handler.Requests.Single(q => q.Url.Host == "inventory-api").Url.Query, "pageSize=100");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(2, json.GetProperty("receipts").GetInt32(), "August's receipt is outside this month");
        Assert.AreEqual(500m, json.GetProperty("total").GetDecimal());
        Assert.AreEqual("Dairy Co", json.GetProperty("bySupplier")[0].GetProperty("supplier").GetString());
        Assert.AreEqual("Milk", json.GetProperty("latest")[0].GetProperty("biggestLines")[0].GetProperty("item").GetString());
    }

    [TestMethod]
    public async Task Counts_show_the_biggest_differences_first()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/counts", _ => new
        {
            items = new[]
            {
                new
                {
                    id = 4, branchId = 1, note = "Month end", countedBy = "Ali", countedAt = new DateTime(2026, 9, 21, 20, 0, 0, DateTimeKind.Utc), linesCounted = 3, linesOff = 2,
                    lines = new[]
                    {
                        new { stockItemId = 11, name = new { en = "Coffee beans", ar = "بن" }, unit = "g", expected = 1000m, counted = 990m, variance = -10m },
                        new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", expected = 5000m, counted = 4000m, variance = -1000m },
                        new { stockItemId = 13, name = new { en = "Cups", ar = "أكواب" }, unit = "pcs", expected = 50m, counted = 50m, variance = 0m },
                    },
                },
            },
            totalCount = 6,
        });

        var result = await Tools(bench).GetStockCounts("Nasr City", 3, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.AreEqual("1", bench.Handler.Requests.Single(q => q.Url.Host == "inventory-api").Branch);
        var branch = Bench.JsonOf(result).GetProperty("branches")[0];
        Assert.AreEqual(6, branch.GetProperty("countsEver").GetInt32());
        var diffs = branch.GetProperty("counts")[0].GetProperty("biggestDifferences").EnumerateArray().ToList();
        Assert.AreEqual(2, diffs.Count, "a line that was right is not a difference");
        Assert.AreEqual("Milk", diffs[0].GetProperty("item").GetString());
    }

    [TestMethod]
    public async Task A_transfer_seen_from_both_branches_is_told_once_with_both_names()
    {
        var bench = new Bench().WithTenant();
        var transfer = new
        {
            id = 30, fromBranchId = 2, toBranchId = 1, note = "Weekend rush", sentBy = "Mona", sentAt = new DateTime(2026, 9, 21, 10, 0, 0, DateTimeKind.Utc),
            lines = new[] { new { stockItemId = 12, name = new { en = "Milk", ar = "لبن" }, unit = "ml", quantity = 2000m } },
        };
        bench.Handler.OnJson("GET", "inventory-api/api/inventory/transfers", _ => new { items = new[] { transfer }, totalCount = 1 });

        var result = await Tools(bench).GetTransfers(null, 10, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        Assert.AreEqual(2, bench.Handler.Requests.Count(q => q.Url.Host == "inventory-api"), "both active branches are asked");
        var transfers = Bench.JsonOf(result).GetProperty("transfers").EnumerateArray().ToList();
        Assert.AreEqual(1, transfers.Count);
        Assert.AreEqual("Maadi", transfers[0].GetProperty("from").GetString());
        Assert.AreEqual("مدينة نصر", transfers[0].GetProperty("toAr").GetString());
    }

    [TestMethod]
    public async Task Without_inventory_in_the_plan_the_tool_says_so()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.On("GET", "inventory-api/api/inventory/counts", _ => new HttpResponseMessage(HttpStatusCode.PaymentRequired));

        var result = await Tools(bench).GetStockCounts(null, 3, CancellationToken.None);

        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "Inventory is not included in this business's plan");
    }
}
