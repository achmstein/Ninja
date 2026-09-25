using Microsoft.Extensions.Configuration;
using Ninja.Catalog.API.Infrastructure;

namespace Catalog.UnitTests.Infrastructure;

/// <summary>
/// A sample stack's menu is the one its kind of place would have: coffee
/// for a coffee shop, grills for a restaurant, snacks for a game station,
/// burgers and combos for a cloud kitchen, the generic café otherwise.
/// </summary>
[TestClass]
public class SampleMenusTest
{
    private static IConfiguration Config(string? business) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Seed:Profile"] = "sample", ["Tenant:BusinessType"] = business })
        .Build();

    [TestMethod]
    [DataRow("coffee_shop", "coffee_shop")]
    [DataRow("Restaurant ", "restaurant")]
    [DataRow("game_station", "game_station")]
    [DataRow("cloud_kitchen", "cloud_kitchen")]
    [DataRow("other", "other")]
    [DataRow("spaceship", "other")]
    [DataRow(null, "other")]
    public void The_kind_of_place_is_read_from_the_stacks_configuration(string? configured, string expected)
    {
        Assert.AreEqual(expected, SeedProfile.Business(Config(configured)));
    }

    [TestMethod]
    [DataRow("coffee_shop", "Coffee", "Cappuccino")]
    [DataRow("other", "Coffee", "Cappuccino")]
    [DataRow("restaurant", "Starters", "Mixed Grill")]
    [DataRow("game_station", "Hot Drinks", "Nachos")]
    [DataRow("cloud_kitchen", "Burgers", "Burger Combo")]
    public void Each_kind_plants_its_own_menu(string business, string firstCategory, string signatureItem)
    {
        var menu = SampleMenus.For(business);

        Assert.AreEqual(firstCategory, menu.Types.OrderBy(t => t.DisplayOrder).First().Name.En);
        Assert.IsTrue(menu.Items.Any(i => i.Name.En == signatureItem), $"{business} sells {signatureItem}");
    }

    [TestMethod]
    public void A_cloud_kitchen_sends_out_food_not_coffee_and_a_restaurant_has_no_espresso_bar()
    {
        Assert.IsFalse(SampleMenus.For("cloud_kitchen").Items.Any(i => i.Name.En is "Cappuccino" or "Espresso"));
        Assert.IsFalse(SampleMenus.For("restaurant").Items.Any(i => i.Name.En == "Cappuccino"));
    }

    /// <summary>Every item shows its own photo, and the image ships it.</summary>
    [TestMethod]
    [DataRow("coffee_shop")]
    [DataRow("restaurant")]
    [DataRow("game_station")]
    [DataRow("cloud_kitchen")]
    public void Every_sample_item_has_a_picture_the_image_ships(string business)
    {
        var pics = Path.Combine(AppContext.BaseDirectory, "Pics");

        foreach (var item in SampleMenus.For(business).Items)
        {
            Assert.IsFalse(string.IsNullOrEmpty(item.PictureFileName), $"{item.Name.En} has a picture");
            Assert.IsTrue(File.Exists(Path.Combine(pics, item.PictureFileName)), $"{item.PictureFileName} ships");
        }
    }

    [TestMethod]
    public void No_two_kinds_share_a_photo()
    {
        var pictures = new[] { "restaurant", "game_station", "cloud_kitchen" }
            .SelectMany(b => SampleMenus.For(b).Items.Select(i => i.PictureFileName))
            .ToList();

        Assert.AreEqual(pictures.Count, pictures.Distinct().Count());
    }

    [TestMethod]
    [DataRow("coffee_shop")]
    [DataRow("restaurant")]
    [DataRow("game_station")]
    [DataRow("cloud_kitchen")]
    public void Every_sample_menu_is_whole(string business)
    {
        var menu = SampleMenus.For(business);

        // Categories in order, ids the items can point at
        CollectionAssert.AreEqual(Enumerable.Range(1, menu.Types.Count).ToList(), menu.Types.Select(t => t.Id).ToList());
        CollectionAssert.AreEqual(Enumerable.Range(1, menu.Types.Count).ToList(), menu.Types.Select(t => t.DisplayOrder).ToList());
        var typeIds = menu.Types.Select(t => t.Id).ToHashSet();
        foreach (var type in menu.Types)
        {
            Assert.IsFalse(string.IsNullOrWhiteSpace(type.Name.Ar), $"{type.Name.En} has an Arabic name");
            Assert.IsTrue(menu.Items.Any(i => i.CatalogTypeId == type.Id), $"{type.Name.En} is not empty");
        }

        // Every item bilingual, priced, in a category, with a name the customizations can find
        Assert.AreEqual(menu.Items.Count, menu.Items.Select(i => i.Name.En).Distinct().Count());
        foreach (var item in menu.Items)
        {
            Assert.IsFalse(string.IsNullOrWhiteSpace(item.Name.Ar), $"{item.Name.En} has an Arabic name");
            Assert.IsFalse(string.IsNullOrWhiteSpace(item.Description.Ar), $"{item.Name.En} has an Arabic description");
            Assert.IsGreaterThan(0m, item.Price, $"{item.Name.En} has a price");
            Assert.Contains(item.CatalogTypeId, typeIds);
        }

        // Customizations belong to items that exist, one row each, with a default where one is required
        Assert.IsNotEmpty(menu.Customizations);
        var names = menu.Items.Select(i => i.Name.En).ToHashSet();
        Assert.AreEqual(menu.Customizations.Count, menu.Customizations.Select(c => c.Customization).Distinct().Count());
        foreach (var (item, customization) in menu.Customizations)
        {
            Assert.Contains(item, names);
            Assert.IsFalse(string.IsNullOrWhiteSpace(customization.Name.Ar));
            Assert.IsTrue(customization.Options.All(o => !string.IsNullOrWhiteSpace(o.Name.Ar)));
            if (customization.IsRequired) Assert.AreEqual(1, customization.Options.Count(o => o.IsDefault), $"{item}: {customization.Name.En}");
        }
    }
}
