using Ninja.Catalog.API;
using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests;

/// <summary>What the menu import refuses before anything is saved.</summary>
[TestClass]
public class MenuImportValidationTest
{
    private static MenuImportItem Item(string en = "Latte", decimal price = 40, MenuImportChoice? choice = null)
        => new(new LocalizedText(en, null), null, price, choice);

    private static MenuImportRequest New(params MenuImportItem[] items)
        => new([new MenuImportCategory(null, new LocalizedText("Coffee", "قهوة"), items)]);

    [TestMethod]
    public void A_new_category_with_named_priced_items_passes()
    {
        var sizes = new MenuImportChoice(new LocalizedText("Size", null), [new(new LocalizedText("Small", null), 40), new(new LocalizedText("Large", null), 50)]);

        Assert.IsNull(MenuImportApi.Validate(New(Item(), Item("Mocha", 0, sizes))));
    }

    [TestMethod]
    public void Each_problem_says_where_it_is()
    {
        Assert.AreEqual("Nothing to save.", MenuImportApi.Validate(new MenuImportRequest([])));
        StringAssert.Contains(MenuImportApi.Validate(new MenuImportRequest([new MenuImportCategory(null, new LocalizedText("", null), [Item()])])), "Category 1 needs a name");
        StringAssert.Contains(MenuImportApi.Validate(New()), "Category 1 has no items");
        StringAssert.Contains(MenuImportApi.Validate(New(Item(), Item(""))), "Category 1, item 2: a name is needed");
        StringAssert.Contains(MenuImportApi.Validate(New(Item(price: -1))), "cannot be negative");

        var one = new MenuImportChoice(new LocalizedText("Size", null), [new(new LocalizedText("Small", null), 40)]);
        StringAssert.Contains(MenuImportApi.Validate(New(Item(choice: one))), "2 to 8 options");
    }

    [TestMethod]
    public void A_menu_in_one_language_passes()
    {
        var sizes = new MenuImportChoice(new LocalizedText(null, "الحجم"), [new(new LocalizedText(null, "صغير"), 40), new(new LocalizedText(null, "كبير"), 50)]);
        var arabicOnly = new MenuImportRequest([new MenuImportCategory(null, new LocalizedText(null, "قهوة"),
            [new MenuImportItem(new LocalizedText(null, "لاتيه"), null, 40, sizes)])]);

        Assert.IsNull(MenuImportApi.Validate(arabicOnly));
    }

    [TestMethod]
    public void An_existing_category_needs_no_name()
    {
        Assert.IsNull(MenuImportApi.Validate(new MenuImportRequest([new MenuImportCategory(3, null, [Item()])])));
    }
}
