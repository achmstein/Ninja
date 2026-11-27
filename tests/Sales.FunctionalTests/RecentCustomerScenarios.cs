using System.Net;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

public record RecentCustomerView(string CustomerId, string CustomerName, DateTime LastAt);
public record RecentLineView(int Id);
public record RecentTicketView(int Id, List<RecentLineView> Lines);

/// <summary>
/// The customers a till offers before a name is typed: whoever the branch last rang something up
/// for, read from its bills, so every till of the branch offers the same people.
/// </summary>
[TestClass]
public sealed class RecentCustomerScenarios
{
    private const string Version = "api-version=1.0";

    private static int _nextBranch = 8500;
    private static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    private static Caller TillAt(int branch) => Suite.Sales.As(Persona.Cashier(branch), branch);
    private static Caller OwnerAt(int branch) => Suite.Sales.As(Persona.Owner(branch), branch);

    private static string Url(string path) => $"{path}?{Version}";

    /// <summary>A counter bill with one item rung up for somebody.</summary>
    private static async Task<int> ABillForAsync(Caller till, string? customerId, string customerName)
    {
        var opened = await till.PostAsync<OpenedTicketView>(Url("/api/tickets"), new { type = 2 });
        var (added, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{opened.TicketId}/lines"),
            new { description = new { en = "Latte", ar = "Latte" }, qty = 1m, unitPrice = 60m });
        Assert.AreEqual(HttpStatusCode.OK, added, detail);
        var line = (await till.GetAsync<RecentTicketView>(Url($"/api/tickets/{opened.TicketId}"))).Lines.Single().Id;
        var (named, why) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{opened.TicketId}/lines/customer"),
            new { lineIds = new[] { line }, customerId, customerName });
        Assert.AreEqual(HttpStatusCode.NoContent, named, why);
        return opened.TicketId;
    }

    private static Task<List<RecentCustomerView>> RecentAsync(Caller till, int? take = null)
        => till.GetAsync<List<RecentCustomerView>>($"/api/tickets/recent-customers?{Version}{(take is { } n ? $"&take={n}" : "")}");

    [TestMethod]
    public async Task The_till_is_offered_whoever_the_branch_last_rang_something_up_for_latest_first_and_once_each()
    {
        var branch = NewBranch();
        var till = TillAt(branch);

        await ABillForAsync(till, "user-mona", "Mona Ali");
        await ABillForAsync(till, "user-ahmed", "Ahmed Hassan");
        // A name the till was only told is nobody to find again
        await ABillForAsync(till, null, "Somebody");
        // Mona again, under the name her account has now: she moves to the top, once
        await ABillForAsync(till, "user-mona", "Mona Ali Hassan");

        var recent = await RecentAsync(till);

        CollectionAssert.AreEqual(new[] { "user-mona", "user-ahmed" }, recent.Select(c => c.CustomerId).ToArray());
        Assert.AreEqual("Mona Ali Hassan", recent[0].CustomerName, "her name as the latest bill had it");
        Assert.AreEqual(1, (await RecentAsync(till, take: 1)).Count);
    }

    [TestMethod]
    public async Task Another_branchs_customers_and_a_voided_bills_are_not_offered()
    {
        var here = NewBranch();
        var there = NewBranch();
        await ABillForAsync(TillAt(there), "user-elsewhere", "Sara Nabil");
        var mistake = await ABillForAsync(TillAt(here), "user-mistake", "Karim Adel");
        var (voided, why) = await OwnerAt(here).RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{mistake}/void"), new { reason = "Rung up by mistake" });
        Assert.IsTrue(voided is HttpStatusCode.OK or HttpStatusCode.NoContent, why);
        await ABillForAsync(TillAt(here), "user-regular", "Lina Kamal");

        var recent = await RecentAsync(TillAt(here));

        CollectionAssert.AreEqual(new[] { "user-regular" }, recent.Select(c => c.CustomerId).ToArray());
    }

    [TestMethod]
    public async Task The_list_is_the_tills_and_nobody_elses()
    {
        using var nobody = Suite.Sales.CreateClient();
        using var response = await nobody.GetAsync($"/api/tickets/recent-customers?{Version}");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
