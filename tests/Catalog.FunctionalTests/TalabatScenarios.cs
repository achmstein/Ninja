using System.Net;
using System.Text.Json;
using Ninja.Testing;

namespace Ninja.Catalog.FunctionalTests;

public record TalabatStatus(bool Connected, int[] BranchIds, bool SyncOpenClose, DateTime? MenuChangedAt, DateTime? MenuSentAt, string? LastMenuResult, int Pending);

/// <summary>
/// The business on Talabat, from its catalog: putting a branch on Talabat sends it
/// the menu, an edit marks the menu for sending, a stock-out goes at once,
/// and what Talabat would be sent can be read. Nothing is actually sent here:
/// the test stack has no relay, so it all waits in the queue.
/// </summary>
[TestClass]
public sealed class TalabatScenarios
{
    private const string Version = "api-version=1.0";
    private static string Talabat(string tail = "") => $"/api/catalog/talabat{tail}?{Version}";

    private static Caller Owner => Suite.Catalog.As(Persona.Owner(Suite.Branch), Suite.Branch);
    private static Caller Admin => Suite.Catalog.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Till => Suite.Catalog.As(Persona.Cashier(Suite.Branch), Suite.Branch);

    [TestMethod]
    public async Task A_branch_on_talabat_hears_about_its_menu_and_its_stock()
    {
        var before = await Owner.GetAsync<TalabatStatus>(Talabat());
        Assert.IsFalse(before.Connected, "the test stack has no relay");

        // On Talabat: its menu is queued at once
        var on = await Owner.PutAsync<TalabatStatus>(Talabat(), new { branchIds = new[] { Suite.Branch }, syncOpenClose = true });
        CollectionAssert.AreEqual(new[] { Suite.Branch }, on.BranchIds);
        Assert.IsTrue(on.Pending >= 1, "the branch's menu waits to go");

        // Exactly what it would be sent: the seeded menu, under the codes orders come back with
        var preview = await Owner.GetAsync<JsonElement>(Talabat($"/preview/{Suite.Branch}"));
        var items = preview.GetProperty("items");
        Assert.IsTrue(items.TryGetProperty("menu", out _));
        var firstItem = items.EnumerateObject().First(p => p.Name.StartsWith("item-"));
        Assert.AreEqual("Product", firstItem.Value.GetProperty("type").GetString());

        // The till takes a dish off: that goes on its own, not waiting for a menu
        var id = int.Parse(firstItem.Name["item-".Length..]);
        var pendingBefore = (await Owner.GetAsync<TalabatStatus>(Talabat())).Pending;
        await Till.SendAsync<JsonElement>(HttpMethod.Patch, $"/api/catalog/items/{id}/availability?{Version}", new { isAvailable = false }, HttpStatusCode.OK);
        Assert.IsTrue((await Owner.GetAsync<TalabatStatus>(Talabat())).Pending > pendingBefore, "the stock-out is queued");
        await Till.SendAsync<JsonElement>(HttpMethod.Patch, $"/api/catalog/items/{id}/availability?{Version}", new { isAvailable = true }, HttpStatusCode.OK);

        // Only the owner decides where the business sells; the platform may ask for the menu, nobody else
        var (adminStatus, _) = await Admin.RefusedAsync(HttpMethod.Put, Talabat(), new { branchIds = Array.Empty<int>() });
        Assert.AreEqual(HttpStatusCode.Forbidden, adminStatus);
        var push = await Suite.Catalog.As(Persona.ControlPlane(), Suite.Branch).RawAsync(HttpMethod.Post, Talabat("/push"));
        Assert.AreEqual(HttpStatusCode.Accepted, push.StatusCode);
        var (tillPush, _) = await Till.RefusedAsync(HttpMethod.Post, Talabat("/push"));
        Assert.AreEqual(HttpStatusCode.Forbidden, tillPush);

        // Off Talabat again: nothing more is queued for it
        var off = await Owner.PutAsync<TalabatStatus>(Talabat(), new { branchIds = Array.Empty<int>(), syncOpenClose = true });
        Assert.AreEqual(0, off.BranchIds.Length);
    }
}
