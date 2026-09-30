using System.Net;
using Ninja.Testing;

namespace Ninja.Catalog.FunctionalTests;

/// <summary>An item as the menu list carries it, with what it suggests.</summary>
public record PairedItemView(int Id, bool IsAvailable, List<int> PairedItemIds);

/// <summary>
/// "Goes well with": the back office picks what an item suggests, and the
/// menu a customer reads carries it, in the owner's order.
/// </summary>
[TestClass]
public sealed class PairingScenarios
{
    private const string Version = "api-version=1.0";
    private static string Items(string tail = "") => $"/api/catalog/items{tail}?{Version}";
    private static string Pairings(int itemId) => Items($"/{itemId}/pairings");

    private static Caller Customer => Suite.Catalog.As(Persona.Customer(), Suite.Branch);
    private static Caller Admin => Suite.Catalog.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Till => Suite.Catalog.As(Persona.Cashier(Suite.Branch), Suite.Branch);

    private static async Task<int[]> ItemsAsync(int count)
    {
        var category = await Admin.PostAsync<CategoryView>($"/api/catalog/categories?{Version}", new { name = new { en = $"Pairs {Guid.NewGuid():N}"[..12], ar = "مع" }, displayOrder = 1 }, HttpStatusCode.Created);
        var ids = new int[count];
        for (var i = 0; i < count; i++)
        {
            var item = await Admin.PostAsync<ItemView>(Items(), new
            {
                name = new { en = $"Paired {i} {Guid.NewGuid():N}"[..16], ar = "صنف" },
                price = 10m + i,
                catalogTypeId = category.Id,
                isAvailable = true,
            }, HttpStatusCode.Created);
            ids[i] = item.Id;
        }
        return ids;
    }

    private static async Task<PairedItemView> OnTheMenuAsync(int id)
        => (await Customer.GetAsync<List<PairedItemView>>(Items())).Single(i => i.Id == id);

    [TestMethod]
    public async Task The_seeded_menu_already_suggests_something_with_its_coffee()
    {
        var menu = await Customer.GetAsync<List<ItemView>>(Items());
        var paired = await Customer.GetAsync<List<PairedItemView>>(Items());
        int IdOf(string name) => menu.Single(i => i.Name.En == name).Id;

        CollectionAssert.AreEqual(
            new[] { IdOf("Waffle"), IdOf("Ice Cream Scoop") },
            paired.Single(i => i.Id == IdOf("Turkish Coffee")).PairedItemIds);
    }

    [TestMethod]
    public async Task The_back_office_pairs_items_and_the_customer_sees_them_in_order()
    {
        var (coffee, cake, cookie) = await ItemsAsync(3) is [var a, var b, var c] ? (a, b, c) : default;

        Assert.IsEmpty(await Admin.GetAsync<List<int>>(Pairings(coffee)), "a new item suggests nothing");
        Assert.IsEmpty((await OnTheMenuAsync(coffee)).PairedItemIds);

        var saved = await Admin.PutAsync<List<int>>(Pairings(coffee), new[] { cookie, cake });
        CollectionAssert.AreEqual(new[] { cookie, cake }, saved);

        CollectionAssert.AreEqual(new[] { cookie, cake }, await Admin.GetAsync<List<int>>(Pairings(coffee)), "the owner's order is kept");
        CollectionAssert.AreEqual(new[] { cookie, cake }, (await OnTheMenuAsync(coffee)).PairedItemIds);
        Assert.IsEmpty((await OnTheMenuAsync(cake)).PairedItemIds, "a pairing goes one way");

        await Admin.PutAsync<List<int>>(Pairings(coffee), new[] { cake });
        CollectionAssert.AreEqual(new[] { cake }, (await OnTheMenuAsync(coffee)).PairedItemIds, "saving replaces the list");

        await Admin.PutAsync<List<int>>(Pairings(coffee), Array.Empty<int>());
        Assert.IsEmpty((await OnTheMenuAsync(coffee)).PairedItemIds, "and an empty list clears it");
    }

    [TestMethod]
    public async Task A_pairing_names_other_items_of_the_menu_each_once_and_only_a_handful()
    {
        var ids = await ItemsAsync(6);
        var item = ids[0];

        foreach (var (body, because) in new (int[], string)[]
        {
            ([item], "an item is not suggested with itself"),
            ([ids[1], ids[1]], "each item once"),
            ([ids[1], 999_999], "only what is on the menu"),
            ([ids[1], ids[2], ids[3], ids[4], ids[5]], "a handful, not the menu again"),
        })
        {
            var (status, _) = await Admin.RefusedAsync(HttpMethod.Put, Pairings(item), body);
            Assert.AreEqual(HttpStatusCode.BadRequest, status, because);
        }
        Assert.IsEmpty(await Admin.GetAsync<List<int>>(Pairings(item)), "a refused list changes nothing");

        var (missing, _) = await Admin.RefusedAsync(HttpMethod.Put, Pairings(999_999), new[] { item });
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task Pairings_are_the_back_offices_to_write()
    {
        var (item, other) = await ItemsAsync(2) is [var a, var b] ? (a, b) : default;

        foreach (var caller in new[] { Customer, Till })
        {
            var (status, _) = await caller.RefusedAsync(HttpMethod.Put, Pairings(item), new[] { other });
            Assert.AreEqual(HttpStatusCode.Forbidden, status);
        }
    }

    [TestMethod]
    public async Task A_deleted_item_is_no_longer_suggested()
    {
        var (burger, fries, drink) = await ItemsAsync(3) is [var a, var b, var c] ? (a, b, c) : default;
        await Admin.PutAsync<List<int>>(Pairings(burger), new[] { fries, drink });

        var (deleted, _) = await Admin.RefusedAsync(HttpMethod.Delete, Items($"/{fries}"));
        Assert.AreEqual(HttpStatusCode.NoContent, deleted);

        CollectionAssert.AreEqual(new[] { drink }, (await OnTheMenuAsync(burger)).PairedItemIds);
    }

    [TestMethod]
    public async Task A_suggestion_the_branch_ran_out_of_stays_paired_and_reads_as_unavailable()
    {
        var (burger, fries) = await ItemsAsync(2) is [var a, var b] ? (a, b) : default;
        await Admin.PutAsync<List<int>>(Pairings(burger), new[] { fries });

        await Till.SendAsync<ItemView>(HttpMethod.Patch, Items($"/{fries}/availability"), new { isAvailable = false }, HttpStatusCode.OK);

        // The apps drop it from the suggestions; the pairing is the owner's and outlives the service
        CollectionAssert.AreEqual(new[] { fries }, (await OnTheMenuAsync(burger)).PairedItemIds);
        Assert.IsFalse((await OnTheMenuAsync(fries)).IsAvailable);
    }
}
