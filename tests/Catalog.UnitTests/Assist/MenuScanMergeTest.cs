using Ninja.AI.Agents;
using Ninja.Catalog.API.Assist;

namespace Catalog.UnitTests.Assist;

/// <summary>A menu's pages read one by one become one menu.</summary>
[TestClass]
public class MenuScanMergeTest
{
    private static ExtractedItem Item(string en, decimal price) => new($"{en} {price}", en, "", "", "", price, "", "", []);

    private static MenuScanner.PageRead Page(params ExtractedCategory[] categories) => new(new MenuExtraction(categories, ""), null);

    [TestMethod]
    public void A_section_that_goes_on_over_the_page_is_one_section_in_first_appearance_order()
    {
        var merged = MenuScanner.Merge(
        [
            Page(new ExtractedCategory("Hot Drinks", "", 0, [Item("Tea", 15)]), new ExtractedCategory("Juices", "", 5, [Item("Orange", 40)])),
            Page(new ExtractedCategory("hot  drinks", "", 1, [Item("Coffee", 25)]), new ExtractedCategory("Desserts", "", 0, [Item("Cake", 60)])),
        ]);

        CollectionAssert.AreEqual(new[] { "Hot Drinks", "Juices", "Desserts" }, merged.Categories.Select(c => c.NameEn).ToList());
        CollectionAssert.AreEqual(new[] { "Tea", "Coffee" }, merged.Categories[0].Items.Select(i => i.NameEn).ToList());
        Assert.AreEqual(1, merged.Categories[0].CatalogTypeId, "a later page's match fills in what the first page did not have");
        Assert.AreEqual("", merged.Notes);
    }

    [TestMethod]
    public void A_page_that_could_not_be_read_is_named_and_the_rest_still_count()
    {
        var merged = MenuScanner.Merge(
        [
            Page(new ExtractedCategory("Hot Drinks", "", 0, [Item("Tea", 15)])),
            new MenuScanner.PageRead(null, new AITruncatedException("menu-scanner", 16384)),
            new MenuScanner.PageRead(null, new AITimeoutException("menu-scanner", TimeSpan.FromSeconds(90))),
        ]);

        Assert.HasCount(1, merged.Categories);
        StringAssert.Contains(merged.Notes, "Page 2: could not be read (too much on one photo");
        StringAssert.Contains(merged.Notes, "Page 3: could not be read (try it again)");
    }

    [TestMethod]
    public void Arabic_only_sections_merge_by_their_arabic_name()
    {
        var merged = MenuScanner.Merge(
        [
            Page(new ExtractedCategory("", "مشروبات سخنة", 0, [Item("Tea", 15)])),
            Page(new ExtractedCategory("", "مشروبات  سخنة", 0, [Item("Coffee", 25)])),
        ]);

        Assert.HasCount(1, merged.Categories);
        Assert.HasCount(2, merged.Categories[0].Items);
    }
}
