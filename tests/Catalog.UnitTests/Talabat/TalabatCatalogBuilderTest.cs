using System.Text.Json.Nodes;
using Ninja.Catalog.API.Model;
using Ninja.Catalog.API.Talabat;

namespace Ninja.Catalog.UnitTests.Talabat;

[TestClass]
public class TalabatCatalogBuilderTest
{
    private static (List<CatalogItem> Items, CatalogType Drinks) Menu()
    {
        var drinks = new CatalogType(new LocalizedText("Drinks", "مشروبات")) { Id = 3, DisplayOrder = 1 };
        var milk = new ItemCustomization(new LocalizedText("Milk", "الحليب")) { Id = 5, IsRequired = true, AllowMultiple = false };
        milk.Options.Add(new CustomizationOption(new LocalizedText("Whole", null)) { Id = 7, PriceAdjustment = 0 });
        milk.Options.Add(new CustomizationOption(new LocalizedText("Oat", "شوفان")) { Id = 8, PriceAdjustment = 7.5m });
        var latte = new CatalogItem(new LocalizedText("Latte", "لاتيه"), new LocalizedText("Espresso and milk", null))
        {
            Id = 12, Price = 60, CatalogTypeId = 3, CatalogType = drinks, PictureFileName = "latte.webp",
        };
        latte.Customizations.Add(milk);
        var tea = new CatalogItem(new LocalizedText("Tea", null)) { Id = 13, Price = 25, CatalogTypeId = 3, CatalogType = drinks };
        return ([latte, tea], drinks);
    }

    private static JsonObject Items(JsonObject catalog) => catalog["items"]!.AsObject();

    [TestMethod]
    public void Every_dish_and_option_carries_the_remote_code_an_order_comes_back_with()
    {
        var (items, _) = Menu();

        var all = Items(TalabatCatalogBuilder.Build(items, [], new HashSet<int>(), "https://api.blue.ninja.app"));

        Assert.AreEqual("Product", all["item-12"]!["type"]!.GetValue<string>());
        Assert.AreEqual("60.00", all["item-12"]!["price"]!.GetValue<string>());
        Assert.AreEqual("لاتيه", all["item-12"]!["title"]!["ar"]!.GetValue<string>());
        Assert.AreEqual("7.50", all["option-8"]!["price"]!.GetValue<string>());
        Assert.IsNotNull(all["item-12"]!["toppings"]!["choice-5"]);
        Assert.IsNotNull(all["choice-5"]!["products"]!["option-7"]);
        Assert.IsNotNull(all["category-3"]!["products"]!["item-13"]);
        Assert.IsNotNull(all["menu"]!["products"]!["item-12"]);
    }

    [TestMethod]
    public void A_required_single_choice_is_exactly_one()
    {
        var (items, _) = Menu();

        var quantity = Items(TalabatCatalogBuilder.Build(items, [], new HashSet<int>(), null))["choice-5"]!["quantity"]!;

        Assert.AreEqual(1, quantity["minimum"]!.GetValue<int>());
        Assert.AreEqual(1, quantity["maximum"]!.GetValue<int>());
    }

    [TestMethod]
    public void The_photo_is_the_business_public_picture_address()
    {
        var (items, _) = Menu();

        var all = Items(TalabatCatalogBuilder.Build(items, [], new HashSet<int>(), "https://api.blue.ninja.app/"));

        Assert.AreEqual("https://api.blue.ninja.app/api/catalog/items/12/pic", all["image-12"]!["url"]!.GetValue<string>());
        Assert.IsNull(all["image-13"], "no photo, no image");
    }

    [TestMethod]
    public void The_branch_price_and_stock_decide_what_talabat_sells()
    {
        var (items, _) = Menu();
        BranchItemOverride[] overrides =
        [
            new() { BranchId = 2, CatalogItemId = 12, PriceOverride = 65, IsOutOfStock = true },
            new() { BranchId = 2, CatalogItemId = 13, IsAvailable = false },
        ];

        var all = Items(TalabatCatalogBuilder.Build(items, overrides, new HashSet<int> { 8 }, null));

        Assert.AreEqual("65.00", all["item-12"]!["price"]!.GetValue<string>());
        Assert.IsFalse(all["item-12"]!["active"]!.GetValue<bool>(), "out of stock stays listed, not orderable");
        Assert.IsNull(all["item-13"], "not sold at the branch: not listed");
        Assert.IsFalse(all["option-8"]!["active"]!.GetValue<bool>());
        Assert.IsTrue(all["option-7"]!["active"]!.GetValue<bool>());
    }

    [TestMethod]
    public void A_dish_is_on_when_available_sold_here_and_in_stock()
    {
        var item = new CatalogItem(new LocalizedText("Tea", null)) { Id = 1, IsAvailable = true };

        Assert.IsTrue(TalabatCatalogBuilder.ItemAvailable(item, null));
        Assert.IsFalse(TalabatCatalogBuilder.ItemAvailable(item, new BranchItemOverride { IsOutOfStock = true }));
        Assert.IsFalse(TalabatCatalogBuilder.ItemAvailable(item, new BranchItemOverride { IsAvailable = false }));
        item.IsAvailable = false;
        Assert.IsFalse(TalabatCatalogBuilder.ItemAvailable(item, null));
    }
}
