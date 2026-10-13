using System.Net;
using Ninja.Testing;

namespace Ninja.Tenant.FunctionalTests;

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
    bool RequireSignInForTableOrders,
    bool RequireSignInForDelivery = false);

/// <summary>A branch as far as its delivery goes.</summary>
public record DeliveryBranchView(int Id, bool IsDeliveryEnabled, decimal? DeliveryRadiusKm, double[][]? DeliveryArea = null);

/// <summary>
/// The business's branches: the list every app reads, the owner's to add and
/// edit, and the pause switches the till and the admin flip during a day.
/// </summary>
[TestClass]
public sealed class BranchScenarios
{
    private const string Branches = "/api/branches";

    private static Caller Owner => Suite.TenantApi.As(Persona.Owner());

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
        var listed = await Suite.TenantApi.AsAnonymous().GetAsync<List<BranchView>>(Branches);
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

        var listed = await Suite.TenantApi.AsAnonymous().GetAsync<List<BranchView>>(Branches);
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
        var till = Suite.TenantApi.As(Persona.Cashier(created.Id), created.Id);

        // The kitchen is behind: stop taking orders, keep taking bookings
        var paused = await till.SendAsync<BranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isOrderingEnabled = false }, HttpStatusCode.OK);
        Assert.IsFalse(paused.IsOrderingEnabled);
        Assert.IsTrue(paused.IsReservationsEnabled, "a flag left out is left as it was");

        var back = await till.SendAsync<BranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isOrderingEnabled = true, requireSignInForTableOrders = true }, HttpStatusCode.OK);
        Assert.IsTrue(back.IsOrderingEnabled);
        Assert.IsTrue(back.RequireSignInForTableOrders);
        Assert.IsFalse(back.RequireSignInForDelivery, "delivery for accounts only starts off");

        // Delivery for signed-in customers only: its own switch, the others left as they were
        var accountsOnly = await till.SendAsync<BranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { requireSignInForDelivery = true }, HttpStatusCode.OK);
        Assert.IsTrue(accountsOnly.RequireSignInForDelivery);
        Assert.IsTrue(accountsOnly.RequireSignInForTableOrders);
        var listed = await Owner.GetAsync<List<BranchView>>(Branches);
        Assert.IsTrue(listed.Single(b => b.Id == created.Id).RequireSignInForDelivery, "the branch list tells the apps");

        // A branch this till is not assigned to is not its to pause — and not its to learn about either
        var (elsewhere, _) = await till.RefusedAsync(HttpMethod.Patch, $"{Branches}/999999/settings", new { isOrderingEnabled = false });
        Assert.AreEqual(HttpStatusCode.Forbidden, elsewhere, "the branch on the route must be one the caller works in");

        // The owner works in all of them, so a branch that is not there reads as not there
        var (missing, _) = await Owner.RefusedAsync(HttpMethod.Patch, $"{Branches}/999999/settings", new { isOrderingEnabled = false });
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task A_delivering_branch_keeps_its_place_and_area_and_a_bad_area_is_refused()
    {
        var created = await Owner.PostAsync<BranchView>(Branches, new
        {
            name = new { en = "Delivers", ar = "بيوصل" },
            location = "30.0444, 31.2357",
            deliveryRadiusKm = 5,
            deliveryFee = 20,
            isOrderingEnabled = true,
        }, HttpStatusCode.Created);

        // Switching delivery on without an area is refused, and with one it holds
        var on = await Owner.SendAsync<DeliveryBranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isDeliveryEnabled = true }, HttpStatusCode.OK);
        Assert.IsTrue(on.IsDeliveryEnabled);

        // Taking the area away from a delivering branch is refused, as switching it on without one is
        var (cleared, detail) = await Owner.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new
        {
            name = new { en = "Delivers", ar = "بيوصل" },
            isActive = true,
            displayOrder = 0,
            deliveryRadiusKm = 0,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, cleared);
        Assert.Contains("Turn delivery off first", detail);

        // Off first, then the area may go
        await Owner.SendAsync<DeliveryBranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isDeliveryEnabled = false }, HttpStatusCode.OK);
        var plain = await Owner.PutAsync<DeliveryBranchView>($"{Branches}/{created.Id}", new
        {
            name = new { en = "Delivers", ar = "بيوصل" },
            isActive = true,
            displayOrder = 0,
            deliveryRadiusKm = 0,
        });
        Assert.IsFalse(plain.IsDeliveryEnabled);

        // An area or a fee that is not one never gets in
        var (negative, _) = await Owner.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new
        {
            name = new { en = "Delivers", ar = "بيوصل" },
            isActive = true,
            displayOrder = 0,
            deliveryFee = -1,
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, negative);
    }

    [TestMethod]
    public async Task A_branch_delivers_to_an_area_drawn_on_the_map_and_a_crossed_one_is_refused()
    {
        // A square of streets round Downtown, drawn closed
        double[][] square = [[30.035, 31.225], [30.055, 31.225], [30.055, 31.245], [30.035, 31.245], [30.035, 31.225]];
        var name = new { en = "Drawn", ar = "مرسوم" };

        var created = await Owner.PostAsync<DeliveryBranchView>(Branches, new
        {
            name,
            location = "30.0444, 31.2357",
            deliveryArea = square,
            deliveryFee = 20,
        }, HttpStatusCode.Created);
        Assert.IsNull(created.DeliveryRadiusKm, "no radius: the area is enough");
        Assert.HasCount(4, created.DeliveryArea!, "the repeated closing point is dropped");

        // Delivery goes on with the area alone, and the area is read back as saved
        var on = await Owner.SendAsync<DeliveryBranchView>(HttpMethod.Patch, $"{Branches}/{created.Id}/settings", new { isDeliveryEnabled = true }, HttpStatusCode.OK);
        Assert.IsTrue(on.IsDeliveryEnabled);
        var listed = await Owner.GetAsync<List<DeliveryBranchView>>($"{Branches}/all");
        CollectionAssert.AreEqual(square[2], listed.Single(b => b.Id == created.Id).DeliveryArea![2]);

        // A bow tie crosses itself; a delivering branch's only area cannot go
        var (crossed, crossedDetail) = await Owner.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new
        {
            name, isActive = true, displayOrder = 0,
            deliveryArea = new[] { square[0], square[2], square[1], square[3] },
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, crossed);
        Assert.Contains("cross", crossedDetail);

        var (cleared, clearedDetail) = await Owner.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new
        {
            name, isActive = true, displayOrder = 0,
            deliveryArea = Array.Empty<double[]>(),
        });
        Assert.AreEqual(HttpStatusCode.BadRequest, cleared);
        Assert.Contains("Turn delivery off first", clearedDetail);

        // With a radius to fall back on, the area may go
        var plain = await Owner.PutAsync<DeliveryBranchView>($"{Branches}/{created.Id}", new
        {
            name, isActive = true, displayOrder = 0,
            deliveryRadiusKm = 5,
            deliveryArea = Array.Empty<double[]>(),
        });
        Assert.IsTrue(plain.IsDeliveryEnabled);
        Assert.IsNull(plain.DeliveryArea);
    }

    [TestMethod]
    public async Task Opening_and_editing_a_branch_is_the_owners_alone()
    {
        var created = await Owner.PostAsync<BranchView>(Branches, NewBranch($"Guarded {Guid.NewGuid():N}"[..14]), HttpStatusCode.Created);

        foreach (var persona in new[] { Persona.Admin(), Persona.Cashier(), Persona.Customer() })
        {
            var caller = Suite.TenantApi.As(persona, 1);
            var (post, _) = await caller.RefusedAsync(HttpMethod.Post, Branches, NewBranch("Not mine"));
            Assert.AreEqual(HttpStatusCode.Forbidden, post, $"{persona.Name} does not open branches");

            var (put, _) = await caller.RefusedAsync(HttpMethod.Put, $"{Branches}/{created.Id}", new { name = new { en = "Renamed" }, isActive = true, displayOrder = 0 });
            Assert.AreEqual(HttpStatusCode.Forbidden, put, $"{persona.Name} does not edit them");

            var (all, _) = await caller.RefusedAsync(HttpMethod.Get, $"{Branches}/all");
            Assert.AreEqual(HttpStatusCode.Forbidden, all, $"{persona.Name} does not see the closed ones");
        }

        var (anonymous, _) = await Suite.TenantApi.AsAnonymous().RefusedAsync(HttpMethod.Post, Branches, NewBranch("Nobody's"));
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);
    }
}
