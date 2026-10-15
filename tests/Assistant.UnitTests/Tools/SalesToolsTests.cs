using System.Net;
using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class SalesToolsTests
{
    private static object Range(int branch) => new
    {
        ticketsSettled = branch == 1 ? 12 : 5,
        net = branch == 1 ? 1500.5m : 400m,
        grossSales = branch == 1 ? 1500.5m : 400m,
        netSales = branch == 1 ? 1470.5m : 400m,
        netSalesExVat = branch == 1 ? 1274.18m : 350m,
        subtotal = branch == 1 ? 1600m : 420m,
        discounts = branch == 1 ? 100m : 20m,
        billDiscounts = branch == 1 ? 60m : 20m,
        lineDiscounts = branch == 1 ? 10m : 0m,
        loyaltyAndPromo = branch == 1 ? 30m : 0m,
        changeGiven = branch == 1 ? 50m : 0m,
        cashTendered = branch == 1 ? 1050m : 400m,
        tenderTotals = new[]
        {
            new { tender = "Cash", amount = branch == 1 ? 1000m : 400m, count = branch == 1 ? 8 : 5, tendered = branch == 1 ? 1050m : 400m },
            new { tender = "Card", amount = branch == 1 ? 500.5m : 0m, count = branch == 1 ? 4 : 0, tendered = branch == 1 ? 500.5m : 0m },
        },
        byType = new[] { new { type = "Counter", count = branch == 1 ? 12 : 5, net = branch == 1 ? 1500.5m : 400m } },
        byChannel = new[] { new { channel = "Counter", count = branch == 1 ? 12 : 5, gross = branch == 1 ? 1500.5m : 400m } },
        serviceCharge = 0m,
        vat = branch == 1 ? 200m : 50m,
        vatAdded = branch == 1 ? 200m : 50m,
        deliveryFees = 0m,
        refunds = branch == 1 ? 30m : 0m,
        refundCount = branch == 1 ? 1 : 0,
        tabPayments = branch == 1 ? 200m : 0m,
        tabPaymentCount = branch == 1 ? 1 : 0,
        tabPaymentTenderTotals = branch == 1 ? new[] { new { tender = "Cash", amount = 200m, count = 1, tendered = 200m } } : [],
    };

    [TestMethod]
    public async Task Today_is_totalled_across_branches_with_a_line_per_branch_and_each_branch_its_own_day()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/range", r => Range(int.Parse(r.Headers.GetValues("X-Branch-Id").First())));
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var result = await tools.GetSalesSummary("today", null, null, null, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        Assert.AreEqual("EGP", json.GetProperty("currency").GetString());
        Assert.AreEqual(17, json.GetProperty("total").GetProperty("ticketsSettled").GetInt32());
        var total = json.GetProperty("total");
        Assert.AreEqual(1900.5m, total.GetProperty("grossSales").GetDecimal());
        Assert.AreEqual(30m, total.GetProperty("refunds").GetDecimal());
        Assert.AreEqual(1870.5m, total.GetProperty("netSales").GetDecimal(), "net sales is gross less refunds");
        Assert.AreEqual(1624.18m, total.GetProperty("netSalesExVat").GetDecimal());
        Assert.IsFalse(total.TryGetProperty("net", out _), "no figure called just net for the model to misread");
        StringAssert.Contains(json.GetProperty("definitions").GetString(), "netSales = grossSales - refunds");
        Assert.AreEqual(80m, total.GetProperty("discounts").GetProperty("bill").GetDecimal());
        var tenders = total.GetProperty("tenders").EnumerateArray().ToList();
        Assert.AreEqual("Cash", tenders[0].GetProperty("tender").GetString());
        Assert.AreEqual(1400m, tenders[0].GetProperty("amount").GetDecimal());
        Assert.AreEqual(1450m, tenders[0].GetProperty("tendered").GetDecimal(), "what was handed over, before the change");
        Assert.AreEqual(13, tenders[0].GetProperty("count").GetInt32());
        Assert.AreEqual(50m, total.GetProperty("changeGiven").GetDecimal());
        var tabCash = total.GetProperty("tabPaymentTenders").EnumerateArray().Single();
        Assert.AreEqual(200m, tabCash.GetProperty("amount").GetDecimal(), "tab payments are a series of their own, beside the sales");
        var branches = json.GetProperty("branches").EnumerateArray().ToList();
        Assert.AreEqual(2, branches.Count);
        Assert.AreEqual("Nasr City", branches[0].GetProperty("name").GetString());
        Assert.IsFalse(json.TryGetProperty("errors", out _));

        // 12:00Z on 2026-09-22 is 15:00 Cairo: Nasr City (17:00 start) is still on the 21st, Maadi on the 22nd
        var calls = bench.Handler.Requests.Where(q => q.Url.Host == "sales-api").ToList();
        var nasr = calls.Single(c => c.Branch == "1").Url.Query;
        var maadi = calls.Single(c => c.Branch == "2").Url.Query;
        StringAssert.Contains(nasr, "from=2026-09-21T14:00:00Z");
        StringAssert.Contains(maadi, "from=2026-09-21T21:00:00Z");
        StringAssert.Contains(nasr, "api-version=1.0");
    }

    [TestMethod]
    public async Task One_failing_branch_becomes_an_error_line_and_the_rest_still_answer()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.On("GET", "sales-api/api/tickets/reports/range", r =>
            r.Headers.GetValues("X-Branch-Id").First() == "2" ? new HttpResponseMessage(HttpStatusCode.Forbidden) : FakeHandler.Json(Range(1)));
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var result = await tools.GetSalesSummary("yesterday", null, null, null, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var json = Bench.JsonOf(result);
        Assert.AreEqual(12, json.GetProperty("total").GetProperty("ticketsSettled").GetInt32());
        var errors = json.GetProperty("errors").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.AreEqual(1, errors.Count);
        StringAssert.StartsWith(errors[0], "Maadi:");
    }

    [TestMethod]
    public async Task A_named_branch_a_bad_period_and_a_bad_branch_each_answer_in_a_sentence()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/range", r => Range(int.Parse(r.Headers.GetValues("X-Branch-Id").First())));
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var one = Bench.JsonOf(await tools.GetSalesSummary("last_7_days", null, null, "maadi", CancellationToken.None));
        Assert.AreEqual(1, one.GetProperty("branches").GetArrayLength());
        var maadi = one.GetProperty("branches")[0];
        Assert.AreEqual("Maadi", maadi.GetProperty("name").GetString());
        Assert.AreEqual("المعادي", maadi.GetProperty("nameAr").GetString(), "the Arabic name rides beside the English one");
        Assert.AreEqual(5, one.GetProperty("total").GetProperty("ticketsSettled").GetInt32());

        var badPeriod = await tools.GetSalesSummary("fortnight", null, null, null, CancellationToken.None);
        Assert.IsTrue(badPeriod.IsError);
        StringAssert.Contains(Bench.TextOf(badPeriod), "Unknown period");

        var badBranch = await tools.GetSalesSummary("today", null, null, "Heliopolis", CancellationToken.None);
        Assert.IsTrue(badBranch.IsError);
        StringAssert.Contains(Bench.TextOf(badBranch), "No branch matches");
    }

    [TestMethod]
    public async Task The_breakdown_merges_items_across_branches_and_keeps_the_top_n()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/breakdown", r => new
        {
            byHour = Array.Empty<object>(),
            byWeekday = Array.Empty<object>(),
            byCashier = Array.Empty<object>(),
            byItem = new[]
            {
                // The same item, named a little differently at each branch: one row
                new { description = new { en = r.Headers.GetValues("X-Branch-Id").First() == "1" ? "Turkish Coffee" : "Turkish coffee (double)", ar = "قهوة تركي" }, qty = 10, amount = 300, tickets = 9, catalogItemId = 1 },
                new { description = new { en = "Hibiscus", ar = "كركديه" }, qty = 4, amount = 80, tickets = 4, catalogItemId = 2 },
                new { description = new { en = "Water", ar = "مياه" }, qty = 20, amount = 60, tickets = 15, catalogItemId = 3 },
            },
        });
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var json = Bench.JsonOf(await tools.GetSalesBreakdown("item", "this_month", null, null, null, 2, CancellationToken.None));

        var rows = json.GetProperty("rows").EnumerateArray().ToList();
        Assert.AreEqual(2, rows.Count);
        Assert.AreEqual("Turkish Coffee", rows[0].GetProperty("item").GetString());
        Assert.AreEqual(600m, rows[0].GetProperty("amount").GetDecimal(), "two branches, same item");
        Assert.AreEqual("قهوة تركي", rows[0].GetProperty("itemAr").GetString());
        Assert.AreEqual(1, rows[0].GetProperty("catalogItemId").GetInt32(), "merged by the catalog item, not its name");
        var query = bench.Handler.Requests.First(q => q.Url.Host == "sales-api").Url.Query;
        StringAssert.Contains(query, "tz=Africa%2FCairo", "the zone, so hours across a clock change are each at their own offset");
        Assert.IsFalse(query.Contains("offsetMinutes", StringComparison.Ordinal));

        var bad = await tools.GetSalesBreakdown("colour", "today", null, null, null, 10, CancellationToken.None);
        Assert.IsTrue(bad.IsError);
    }

    [TestMethod]
    public async Task No_open_shift_is_an_answer_not_an_error()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.On("GET", "sales-api/api/shifts/current", r => r.Headers.GetValues("X-Branch-Id").First() == "1"
            ? FakeHandler.Json(new { id = 4, branchId = 1, status = "Open", openedAt = "2026-09-22T09:00:00Z", openedBy = "cashier", openingFloat = 200, ticketsSettled = 3, salesTotal = 150 })
            : new HttpResponseMessage(HttpStatusCode.NotFound));
        bench.Handler.OnJson("GET", "sales-api/api/shifts", _ => Array.Empty<object>());
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var json = Bench.JsonOf(await tools.GetShifts("today", null, null, null, 10, CancellationToken.None));

        var open = json.GetProperty("openNow").EnumerateArray().ToList();
        Assert.AreEqual(2, open.Count);
        Assert.IsTrue(open[0].GetProperty("open").GetBoolean());
        Assert.AreEqual("2026-09-22 12:00", open[0].GetProperty("openedAt").GetString(), "local Cairo time");
        Assert.IsFalse(open[1].GetProperty("open").GetBoolean());
        Assert.IsFalse(json.TryGetProperty("errors", out _));
    }

    [TestMethod]
    public void A_huge_answer_is_refused_rather_than_truncated()
    {
        var result = ToolResults.Ok(new { rows = Enumerable.Range(0, 20_000).Select(i => new { i, text = "row number " + i }) });
        Assert.IsTrue(result.IsError);
        StringAssert.Contains(Bench.TextOf(result), "Too much data");
    }

    [TestMethod]
    public void Arabic_is_left_readable_in_the_json()
    {
        var text = Bench.TextOf(ToolResults.Ok(new { name = "قهوة" }));
        StringAssert.Contains(text, "قهوة");
        Assert.IsFalse(text.Contains("\\u", StringComparison.Ordinal));
        Assert.AreEqual(JsonValueKind.Object, JsonDocument.Parse(text).RootElement.ValueKind);
    }

    [TestMethod]
    public async Task The_daily_trend_is_the_tills_sales_per_business_day_with_orders_beside()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/daily", r => new
        {
            days = new[]
            {
                new { date = "2026-09-21", tickets = 3, grossSales = 300m, refunds = 30m, netSales = 270m, refundCount = 1 },
                new { date = "2026-09-22", tickets = 2, grossSales = 200m, refunds = 0m, netSales = 200m, refundCount = 0 },
            },
        });
        bench.Handler.OnJson("GET", "ordering-api/api/orders/stats", r => new
        {
            days = new[] { new { date = "2026-09-21", orders = 4, revenue = 280m } },
            topItems = new[]
            {
                new { productId = 7, productName = new { en = r.Headers.GetValues("X-Branch-Id").First() == "1" ? "Latte" : "Latte (large)", ar = "لاتيه" }, units = 3, revenue = 150m },
            },
        });
        var tools = new SalesTools(bench.Tenant, bench.Api, bench.Clock);

        var json = Bench.JsonOf(await tools.GetDailySalesTrend());

        var days = json.GetProperty("days").EnumerateArray().ToList();
        Assert.HasCount(2, days);
        Assert.AreEqual(600m, days[0].GetProperty("grossSales").GetDecimal(), "two branches");
        Assert.AreEqual(540m, days[0].GetProperty("netSales").GetDecimal(), "gross less refunds, as in the summary");
        Assert.AreEqual(8, days[0].GetProperty("orders").GetInt32());
        Assert.AreEqual(0, days[1].GetProperty("orders").GetInt32());
        var item = json.GetProperty("topItems").EnumerateArray().Single();
        Assert.AreEqual(300m, item.GetProperty("revenue").GetDecimal(), "one item across branches by its catalog id");

        var daily = bench.Handler.Requests.Where(r => r.Url.AbsolutePath == "/api/tickets/reports/daily").ToList();
        StringAssert.Contains(daily.Single(r => r.Branch == "1").Url.Query, "tz=Africa%2FCairo");
        StringAssert.Contains(daily.Single(r => r.Branch == "1").Url.Query, "dayStart=17%3A00", "Nasr City's day starts at five");
        StringAssert.Contains(daily.Single(r => r.Branch == "2").Url.Query, "dayStart=00%3A00");
        var stats = bench.Handler.Requests.First(r => r.Url.AbsolutePath == "/api/orders/stats").Url.Query;
        StringAssert.Contains(stats, "top=0", "every item, so the branches add up");
        StringAssert.Contains(stats, "tz=Africa%2FCairo");
    }

    [TestMethod]
    public async Task The_overview_calls_gross_less_refunds_net_sales()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/range", r => Range(int.Parse(r.Headers.GetValues("X-Branch-Id").First())));
        var tools = new OverviewTools(bench.Tenant, bench.Api, bench.Clock);

        var today = Bench.JsonOf(await tools.GetBusinessOverview(CancellationToken.None)).GetProperty("today");

        Assert.AreEqual(1900.5m, today.GetProperty("grossSales").GetDecimal());
        Assert.AreEqual(1870.5m, today.GetProperty("netSales").GetDecimal());
        var nasr = today.GetProperty("branches").EnumerateArray().First();
        Assert.AreEqual(1470.5m, nasr.GetProperty("netSales").GetDecimal());
        Assert.AreEqual(30m, nasr.GetProperty("refunds").GetDecimal());
    }
}
