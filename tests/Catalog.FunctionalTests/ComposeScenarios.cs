using System.Net;
using System.Net.Http.Json;
using Ninja.Testing;

namespace Ninja.Catalog.FunctionalTests;

public record ComposedOptionView(int Ref, int Id);

public record ComposeResultView(int ItemId, int CatalogTypeId, List<ComposedOptionView> Options);

/// <summary>
/// A dish made whole in one call, as the owner's assistant sends it: the
/// item, its new category and its options, each option answering the id it
/// got for the caller's reference; the same request id again makes nothing.
/// </summary>
[TestClass]
public sealed class ComposeScenarios
{
    private const string Version = "api-version=1.0";

    private static Caller Admin => Suite.Catalog.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Customer => Suite.Catalog.As(Persona.Customer(), Suite.Branch);

    private static async Task<HttpResponseMessage> ComposeAsync(Guid requestId, object body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/items/compose?{Version}") { Content = JsonContent.Create(body) };
        if (requestId != Guid.Empty) request.Headers.Add("x-requestid", requestId.ToString());
        return await Admin.Http.SendAsync(request);
    }

    private static object Latte(string name) => new
    {
        name = new { en = name, ar = "سبانش لاتيه" },
        description = new { en = "Espresso, milk and condensed milk", ar = (string?)null },
        price = 85m,
        catalogTypeId = (int?)null,
        newCategoryName = new { en = $"Iced {name}", ar = "مثلجات" },
        isPopular = true,
        customizations = new object[]
        {
            new
            {
                name = new { en = "Size", ar = "الحجم" }, isRequired = true, allowMultiple = false,
                options = new object[]
                {
                    new { @ref = 900000001, name = new { en = "Regular", ar = "عادي" }, priceAdjustment = 0m, isDefault = true },
                    new { @ref = 900000002, name = new { en = "Large", ar = "كبير" }, priceAdjustment = 15m, isDefault = false },
                },
            },
            new
            {
                name = new { en = "Milk", ar = "اللبن" }, isRequired = false, allowMultiple = false,
                options = new object[] { new { @ref = 900000003, name = new { en = "Oat milk", ar = "لبن شوفان" }, priceAdjustment = 10m, isDefault = false } },
            },
        },
    };

    [TestMethod]
    public async Task A_dish_is_made_with_its_category_and_options_and_each_reference_gets_its_id()
    {
        var name = $"Spanish {Guid.NewGuid():N}"[..16];
        var response = await ComposeAsync(Guid.NewGuid(), Latte(name));
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
        var result = (await response.Content.ReadFromJsonAsync<ComposeResultView>(Caller.Json))!;

        CollectionAssert.AreEquivalent(new[] { 900000001, 900000002, 900000003 }, result.Options.Select(o => o.Ref).ToList());
        var menu = await Customer.GetAsync<List<ItemView>>($"/api/catalog/items?{Version}");
        Assert.IsTrue(menu.Any(i => i.Id == result.ItemId && i.Name.En == name), "on the menu");

        var customizations = await Customer.GetAsync<List<GroupView>>($"/api/catalog/items/{result.ItemId}/customizations?{Version}");
        var large = customizations.Single(c => c.Name.En == "Size").Options.Single(o => o.Name.En == "Large");
        Assert.AreEqual(result.Options.Single(o => o.Ref == 900000002).Id, large.Id, "the reference answers the option's real id");
        Assert.AreEqual(15m, large.PriceAdjustment);
    }

    [TestMethod]
    public async Task The_same_request_again_makes_nothing_more()
    {
        var requestId = Guid.NewGuid();
        var body = Latte($"Twice {Guid.NewGuid():N}"[..14]);
        var first = (await (await ComposeAsync(requestId, body)).Content.ReadFromJsonAsync<ComposeResultView>(Caller.Json))!;
        var again = (await (await ComposeAsync(requestId, body)).Content.ReadFromJsonAsync<ComposeResultView>(Caller.Json))!;

        Assert.AreEqual(first.ItemId, again.ItemId);
        CollectionAssert.AreEqual(first.Options.Select(o => o.Id).ToList(), again.Options.Select(o => o.Id).ToList());
    }

    [TestMethod]
    public async Task Without_a_request_id_or_a_category_it_is_refused()
    {
        Assert.AreEqual(HttpStatusCode.BadRequest, (await ComposeAsync(Guid.Empty, Latte("No id"))).StatusCode);

        var noCategory = await ComposeAsync(Guid.NewGuid(), new { name = new { en = "Lost", ar = (string?)null }, price = 10m, catalogTypeId = (int?)null, newCategoryName = (object?)null });
        Assert.AreEqual(HttpStatusCode.BadRequest, noCategory.StatusCode);
    }
}
