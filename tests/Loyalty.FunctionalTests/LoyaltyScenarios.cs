using System.Net;
using Ninja.Loyalty.API.Apis;
using Ninja.Testing;

namespace Ninja.Loyalty.FunctionalTests;

/// <summary>The shared services, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public static ServiceUnderTest<Program> Loyalty { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Loyalty = new ServiceUnderTest<Program>("loyaltydb");
        _ = Loyalty.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Loyalty.DisposeAsync();
        await SharedServices.StopAsync();
    }
}


/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record AccountView(int Id, string UserId, string? UserDisplayName, int PointsBalance, int LifetimePoints, string CurrentTier);
public record BalanceView(int Balance, int LifetimePoints, string Tier);
public record TransactionView(int Id, int Points, string Type, string? ReferenceId, string? Description);
public record TierView(string Name, int PointsRequired, string Benefits);
public record StatsView(int TotalAccounts, Dictionary<string, int> AccountsByTier, int PointsIssuedToday);

/// <summary>
/// A café's loyalty card through the API: joining, earning, being adjusted
/// by the back office, and who may look at whose card.
/// </summary>
[TestClass]
public sealed class LoyaltyScenarios
{
    private static string NewCustomer() => $"customer-{Guid.NewGuid():N}";

    [TestMethod]
    public async Task A_customer_joins_earns_and_reads_their_own_card()
    {
        var userId = NewCustomer();
        var customer = Suite.Loyalty.As(Persona.Customer(userId));
        var admin = Suite.Loyalty.As(Persona.Admin());

        var joined = await customer.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(userId, "Mona"), HttpStatusCode.Created);
        Assert.AreEqual(userId, joined.UserId);
        Assert.AreEqual(0, joined.PointsBalance);
        Assert.AreEqual("Bronze", joined.CurrentTier);

        // Points are the café's to give: the till and the back office award them, never the member
        var earned = await admin.PostAsync<TransactionView>("/api/loyalty/transactions/earn?api-version=1.0", new EarnPointsRequest(userId, 1200, "Purchase", "order-1", "Two coffees"));
        Assert.AreEqual(1200, earned.Points);

        var balance = await customer.GetAsync<BalanceView>($"/api/loyalty/accounts/{userId}/balance?api-version=1.0");
        Assert.AreEqual(1200, balance.Balance);
        Assert.AreEqual(1200, balance.LifetimePoints);
        Assert.AreEqual("Silver", balance.Tier, "a thousand earned is Silver");

        var statement = await customer.GetAsync<List<TransactionView>>($"/api/loyalty/transactions/{userId}?api-version=1.0");
        Assert.AreEqual("order-1", statement.Single().ReferenceId);
    }

    [TestMethod]
    public async Task A_card_is_joined_once()
    {
        var userId = NewCustomer();
        var customer = Suite.Loyalty.As(Persona.Customer(userId));
        await customer.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(userId), HttpStatusCode.Created);

        var (status, detail) = await customer.RefusedAsync(HttpMethod.Post, "/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(userId));
        Assert.AreEqual(HttpStatusCode.Conflict, status);
        Assert.Contains("already exists", detail);
    }

    [TestMethod]
    public async Task A_member_reads_their_own_card_and_the_till_reads_the_one_in_front_of_it()
    {
        var mine = NewCustomer();
        var theirs = NewCustomer();
        var me = Suite.Loyalty.As(Persona.Customer(mine));
        var admin = Suite.Loyalty.As(Persona.Admin());
        await me.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(mine), HttpStatusCode.Created);
        await admin.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(theirs), HttpStatusCode.Created);

        var (status, _) = await me.RefusedAsync(HttpMethod.Get, $"/api/loyalty/accounts/{theirs}?api-version=1.0");
        Assert.AreEqual(HttpStatusCode.Forbidden, status, "another member's card is not mine to read");

        var cashier = Suite.Loyalty.As(Persona.Cashier());
        var card = await cashier.GetAsync<AccountView>($"/api/loyalty/accounts/{theirs}?api-version=1.0");
        Assert.AreEqual(theirs, card.UserId, "the till serves whoever is at the counter");

        var (joinOthers, _) = await me.RefusedAsync(HttpMethod.Post, "/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(NewCustomer()));
        Assert.AreEqual(HttpStatusCode.Forbidden, joinOthers, "joining is the customer's own act, or the back office's");
    }

    [TestMethod]
    public async Task The_back_office_adjusts_a_card_and_the_reason_is_on_the_statement()
    {
        var userId = NewCustomer();
        var admin = Suite.Loyalty.As(Persona.Admin());
        await admin.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(userId), HttpStatusCode.Created);
        await admin.PostAsync<TransactionView>("/api/loyalty/transactions/earn?api-version=1.0", new EarnPointsRequest(userId, 500, "Purchase"));

        var adjusted = await admin.PostAsync<TransactionView>("/api/loyalty/transactions/adjust?api-version=1.0", new AdjustPointsRequest(userId, -200, "Goodwill taken back"));
        Assert.AreEqual(-200, adjusted.Points);

        var balance = await admin.GetAsync<BalanceView>($"/api/loyalty/accounts/{userId}/balance?api-version=1.0");
        Assert.AreEqual(300, balance.Balance);
        Assert.AreEqual(500, balance.LifetimePoints, "taking points back does not unmake what was earned");

        var (status, _) = await admin.RefusedAsync(HttpMethod.Post, "/api/loyalty/transactions/adjust?api-version=1.0", new AdjustPointsRequest(NewCustomer(), 10, "nobody"));
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task What_the_card_is_worth_is_the_same_for_everyone_and_the_rest_is_the_back_offices()
    {
        var anyone = Suite.Loyalty.As(Persona.Customer());

        var tiers = await anyone.GetAsync<List<TierView>>("/api/loyalty/tiers?api-version=1.0");
        CollectionAssert.AreEqual(new[] { "Bronze", "Silver", "Gold", "Platinum" }, tiers.Select(t => t.Name).ToArray());
        CollectionAssert.AreEqual(new[] { 0, 1000, 5000, 10000 }, tiers.Select(t => t.PointsRequired).ToArray());

        foreach (var path in new[] { "/api/loyalty/accounts?api-version=1.0", "/api/loyalty/stats?api-version=1.0" })
        {
            var (status, _) = await anyone.RefusedAsync(HttpMethod.Get, path);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{path} is the back office's");
        }

        using var nobody = Suite.Loyalty.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync("/api/loyalty/accounts?api-version=1.0")).StatusCode);
    }

    [TestMethod]
    public async Task The_stats_count_the_cards_the_cafe_has_given_out()
    {
        var admin = Suite.Loyalty.As(Persona.Admin());
        var userId = NewCustomer();
        await admin.PostAsync<AccountView>("/api/loyalty/accounts?api-version=1.0", new CreateAccountRequest(userId), HttpStatusCode.Created);
        await admin.PostAsync<TransactionView>("/api/loyalty/transactions/earn?api-version=1.0", new EarnPointsRequest(userId, 7000, "Purchase"));

        var stats = await admin.GetAsync<StatsView>("/api/loyalty/stats?api-version=1.0");

        Assert.IsTrue(stats.TotalAccounts >= 1);
        Assert.IsTrue(stats.AccountsByTier.TryGetValue("Gold", out var gold) && gold >= 1, "seven thousand earned is Gold");
        Assert.IsTrue(stats.PointsIssuedToday >= 7000);
    }
}
