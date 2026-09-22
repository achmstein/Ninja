using System.Net;
using Ninja.Testing;

namespace Ninja.Branch.FunctionalTests;

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record BranchView(
    int Id,
    LocalizedView Name,
    LocalizedView? Address,
    string? Phone,
    bool IsActive,
    int DisplayOrder,
    string DayStartTime,
    string DayEndTime,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders);

/// <summary>
/// The café's branches: the list every app reads, the owner's to add and
/// edit, and the pause switches the till and the admin flip during a day.
/// </summary>
[TestClass]
public sealed class BranchScenarios
{
    private const string Branches = "/api/branches";

    private static Caller Owner => Suite.Branch.As(Persona.Owner());

    private static object NewBranch(string name, int order = 0, bool ordering = true, bool reservations = true)
        => new { name = new { en = name, ar = name }, address = new { en = "Zamalek", ar = "الزمالك" }, phone = "+201000000000", displayOrder = order, isOrderingEnabled = ordering, isReservationsEnabled = reservations };

    [TestMethod]
    public async Task The_owner_opens_a_branch_and_every_app_can_list_it()
    {
        var name = $"Zamalek {Guid.NewGuid():N}"[..14];

        var created = await Owner.PostAsync<BranchView>(Branches, NewBranch(name, order: 3), HttpStatusCode.Created);

        Assert.AreEqual(name, created.Name.En);
        Assert.IsTrue(created.IsActive, "a new branch is open");
        Assert.AreEqual(3, created.DisplayOrder);
        Assert.IsTrue(created.IsOrderingEnabled);

        // The list is public: the customer app picks a branch before anyone signs in
        var listed = await Suite.Branch.AsAnonymous().GetAsync<List<BranchView>>(Branches);
        Assert.IsTrue(listed.Any(b => b.Id == created.Id), "the branch is on the list every app reads");
    }

    [TestMethod]
    public async Task A_closed_branch_leaves_the_public_list_and_stays_on_the_owners()
    {
        var created = await Owner.PostAsync<BranchView>(Branches, NewBranch($"Closing {Guid.NewGuid():N}"[..14]), HttpStatusCode.Created);

        var closed = await Owner.PutAsync<BranchView>($"{Branches}/{created.Id}", new
        {
            name = new { en = "Closed for the summer", ar = "مقفول" },
            address = new { en = "Zamalek", ar = "الزمالك" },
            phone = "+201000000000",
            isActive = false,
            displayOrder = 9,
        });
        Assert.IsFalse(closed.IsActive);

        var listed = await Suite.Branch.AsAnonymous().GetAsync<List<BranchView>>(Branches);
        Assert.IsFalse(listed.Any(b => b.Id == created.Id), "a closed branch is not offered to customers");

        var all = await Owner.GetAsync<List<BranchView>>($"{Branches}/all");
        Assert.IsTrue(all.Any(b => b.Id == created.Id), "the owner still sees it, to open it again");

        var (status, _) = await Owner.RefusedAsync(HttpMethod.Put, $"{Branches}/999999", new { name = new { en = "Nowhere" }, isActive = true, displayOrder = 0 });
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task The_pause_switches_are_the_tills_to_flip_during_a_day()
    {
        var created = await Owner.PostAsync<BranchView>(Branches, NewBranch($"Busy {Guid.NewGuid():N}"[..14]), HttpStatusCode.Created);
        var till = Suite.Branch.As(Persona.Cashier(created.Id), created.Id);

        // The kitchen is behind: stop taking orders, keep taking bookings
        var paused = await till.SendAsync<BranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isOrderingEnabled = false }, HttpStatusCode.OK);
        Assert.IsFalse(paused.IsOrderingEnabled);
        Assert.IsTrue(paused.IsReservationsEnabled, "a flag left out is left as it was");

        var back = await till.SendAsync<BranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isOrderingEnabled = true, requireSignInForTableOrders = true }, HttpStatusCode.OK);
        Assert.IsTrue(back.IsOrderingEnabled);
        Assert.IsTrue(back.RequireSignInForTableOrders);

        // A branch this till is not assigned to is not its to pause — and not its to learn about either
        var (elsewhere, _) = await till.RefusedAsync(HttpMethod.Patch, $"{Branches}/999999/settings", new { isOrderingEnabled = false });
        Assert.AreEqual(HttpStatusCode.Forbidden, elsewhere, "the branch on the route must be one the caller works in");

        // The owner works in all of them, so a branch that is not there reads as not there
        var (missing, _) = await Owner.RefusedAsync(HttpMethod.Patch, $"{Branches}/999999/settings", new { isOrderingEnabled = false });
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task Opening_and_editing_a_branch_is_the_owners_alone()
    {
        var created = await Owner.PostAsync<BranchView>(Branches, NewBranch($"Guarded {Guid.NewGuid():N}"[..14]), HttpStatusCode.Created);

        foreach (var persona in new[] { Persona.Admin(), Persona.Cashier(), Persona.Customer() })
        {
            var caller = Suite.Branch.As(persona, 1);
            var (post, _) = await caller.RefusedAsync(HttpMethod.Post, Branches, NewBranch("Not mine"));
            Assert.AreEqual(HttpStatusCode.Forbidden, post, $"{persona.Name} does not open branches");

            var (put, _) = await caller.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new { name = new { en = "Renamed" }, isActive = true, displayOrder = 0 });
            Assert.AreEqual(HttpStatusCode.Forbidden, put, $"{persona.Name} does not edit them");

            var (all, _) = await caller.RefusedAsync(HttpMethod.Get, $"{Branches}/all");
            Assert.AreEqual(HttpStatusCode.Forbidden, all, $"{persona.Name} does not see the closed ones");
        }

        var (anonymous, _) = await Suite.Branch.AsAnonymous().RefusedAsync(HttpMethod.Post, Branches, NewBranch("Nobody's"));
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);
    }
}
