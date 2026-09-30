using Ninja.Catalog.API;
using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests;

/// <summary>What the menu import refuses before anything is saved.</summary>
[TestClass]
public class MenuImportValidationTest
{
    private static MenuImportItem Item(string en = "Latte", decimal price = 40, MenuImportChoice? choice = null)
        => new(new LocalizedText(en), null, price, choice);

    private static MenuImportRequest New(params MenuImportItem[] items)
        => new([new MenuImportCategory(null, new LocalizedText("Coffee", "قهوة"), items)]);

    [TestMethod]
    public void A_new_category_with_named_priced_items_passes()
    {
        var sizes = new MenuImportChoice(new LocalizedText("Size"), [new(new LocalizedText("Small"), 40), new(new LocalizedText("Large"), 50)]);

        Assert.IsNull(MenuImportApi.Validate(New(Item(), Item("Mocha", 0, sizes))));
    }

    [TestMethod]
    public void Each_problem_says_where_it_is()
    {
        Assert.AreEqual("Nothing to save.", MenuImportApi.Validate(new MenuImportRequest([])));
        StringAssert.Contains(MenuImportApi.Validate(new MenuImportRequest([new MenuImportCategory(null, new LocalizedText(""), [Item()])])), "Category 1 needs an English name");
        StringAssert.Contains(MenuImportApi.Validate(New()), "Category 1 has no items");
        StringAssert.Contains(MenuImportApi.Validate(New(Item(), Item(""))), "Category 1, item 2: an English name");
        StringAssert.Contains(MenuImportApi.Validate(New(Item(price: -1))), "cannot be negative");

        var one = new MenuImportChoice(new LocalizedText("Size"), [new(new LocalizedText("Small"), 40)]);
        StringAssert.Contains(MenuImportApi.Validate(New(Item(choice: one))), "2 to 8 options");
    }

    [TestMethod]
    public void An_existing_category_needs_no_name()
    {
        Assert.IsNull(MenuImportApi.Validate(new MenuImportRequest([new MenuImportCategory(3, null, [Item()])])));
    }
}
