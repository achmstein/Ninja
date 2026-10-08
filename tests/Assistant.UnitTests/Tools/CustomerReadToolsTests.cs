using System.Net;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class CustomerReadToolsTests
{
    private static CustomerReadTools Tools(Bench bench) => new(bench.Tenant, bench.Api);

    [TestMethod]
    public async Task The_loyalty_overview_is_versioned_chain_wide_and_ranks_members_by_lifetime_points()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "loyalty-api/api/loyalty/stats", _ => new
        {
            totalAccounts = 120,
            accountsByTier = new Dictionary<string, int> { ["Bronze"] = 100, ["Gold"] = 20 },
            pointsIssuedToday = 50,
            pointsIssuedThisWeek = 400,
            pointsIssuedThisMonth = 1500,
        });
        bench.Handler.OnJson("GET", "loyalty-api/api/loyalty/accounts", _ => new[]
        {
            new { id = 2, userId = "u2", userDisplayName = "Nour", pointsBalance = 80, lifetimePoints = 900, currentTier = "Gold", createdAt = DateTime.UtcNow, updatedAt = DateTime.UtcNow },
            new { id = 1, userId = "u1", userDisplayName = "Omar", pointsBalance = 300, lifetimePoints = 1200, currentTier = "Gold", createdAt = DateTime.UtcNow, updatedAt = DateTime.UtcNow },
        });

        var result = await Tools(bench).GetLoyaltyOverview(5, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var calls = bench.Handler.Requests.Where(q => q.Url.Host == "loyalty-api").ToList();
        Assert.IsTrue(calls.All(c => c.Url.Query.Contains("api-version=1.0")), "Loyalty's routes are versioned");
        Assert.IsTrue(calls.All(c => c.Branch is null), "loyalty is the chain's");
        StringAssert.Contains(calls.Single(c => c.Url.AbsolutePath == "/api/loyalty/accounts").Url.Query, "max=5");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(120, json.GetProperty("members").GetInt32());
        Assert.AreEqual(20, json.GetProperty("byTier").GetProperty("Gold").GetInt32());
        Assert.AreEqual(400, json.GetProperty("pointsIssued").GetProperty("last7Days").GetInt32());
        Assert.AreEqual("Omar", json.GetProperty("topMembers")[0].GetProperty("name").GetString());
    }

    [TestMethod]
    public async Task Without_loyalty_in_the_plan_the_tool_says_so()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.On("GET", "loyalty-api/api/loyalty/stats", _ => new HttpResponseMessage(HttpStatusCode.PaymentRequired));

        var result = await Tools(bench).GetLoyaltyOverview(5, CancellationToken.None);

        Assert.IsTrue(result.IsError);
        Assert.AreEqual("Loyalty is not included in this business's plan.", Bench.TextOf(result));
    }

    [TestMethod]
    public async Task Tabs_total_what_customers_owe_biggest_first_and_a_name_searches()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "accounts-api/api/accounts", _ => new[]
        {
            new { id = 1, customerId = "c1", customerName = "Karim", balance = 340m, updatedAt = new DateTime(2026, 9, 20, 18, 0, 0, DateTimeKind.Utc) },
            new { id = 2, customerId = "c2", customerName = "Hana", balance = 900m, updatedAt = new DateTime(2026, 9, 21, 18, 0, 0, DateTimeKind.Utc) },
            new { id = 3, customerId = "c3", customerName = "Tamer", balance = -50m, updatedAt = new DateTime(2026, 9, 19, 18, 0, 0, DateTimeKind.Utc) },
            new { id = 4, customerId = "c4", customerName = "Settled", balance = 0m, updatedAt = new DateTime(2026, 9, 19, 18, 0, 0, DateTimeKind.Utc) },
        });

        var result = await Tools(bench).GetCustomerTabs(null, 20, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        var call = bench.Handler.Requests.Single(q => q.Url.Host == "accounts-api");
        Assert.AreEqual("/api/accounts", call.Url.AbsolutePath);
        Assert.IsFalse(call.Url.Query.Contains("api-version"), "Accounts is not versioned");
        var json = Bench.JsonOf(result);
        Assert.AreEqual(1240m, json.GetProperty("totalOwed").GetDecimal());
        Assert.AreEqual(2, json.GetProperty("customersOwing").GetInt32());
        Assert.AreEqual(50m, json.GetProperty("creditHeld").GetDecimal());
        var tabs = json.GetProperty("tabs").EnumerateArray().ToList();
        Assert.AreEqual(3, tabs.Count, "a settled tab is left out");
        Assert.AreEqual("Hana", tabs[0].GetProperty("customer").GetString());

        await Tools(bench).GetCustomerTabs("Karim Adel", 20, CancellationToken.None);
        var search = bench.Handler.Requests.Last(q => q.Url.Host == "accounts-api");
        Assert.AreEqual("/api/accounts/search", search.Url.AbsolutePath);
        StringAssert.Contains(search.Url.Query, "q=Karim%20Adel");
    }

    [TestMethod]
    public async Task Announcements_come_newest_first_in_the_business_time()
    {
        var bench = new Bench().WithTenant();
        bench.Handler.OnJson("GET", "notification-api/api/notifications/announcements", _ => new[]
        {
            new { id = 1, title = "Old news", body = "…", sentBy = "Owner", sentAt = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc), recipientCount = 80 },
            new { id = 2, title = "Half price Friday", body = "All lattes 50% off", sentBy = "Owner", sentAt = new DateTime(2026, 9, 18, 7, 0, 0, DateTimeKind.Utc), recipientCount = 312 },
        });

        var result = await Tools(bench).GetAnnouncements(5, CancellationToken.None);

        Assert.AreNotEqual(true, result.IsError, Bench.TextOf(result));
        StringAssert.Contains(bench.Handler.Requests.Single(q => q.Url.Host == "notification-api").Url.Query, "limit=5");
        var first = Bench.JsonOf(result).GetProperty("announcements")[0];
        Assert.AreEqual("Half price Friday", first.GetProperty("title").GetString());
        Assert.AreEqual(312, first.GetProperty("reached").GetInt32());
        Assert.AreEqual("2026-09-18 10:00", first.GetProperty("sentAt").GetString());
    }
}
