using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class MenuProposalValidatorTest
{
    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Hot Drinks", "مشروبات سخنة")) { Id = 1 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5 },
    ];

    private static readonly List<CatalogItem> Items =
    [
        new(new LocalizedText("Turkish Coffee", "قهوة تركي")) { Id = 10 },
        new(new LocalizedText("Mango Juice", "عصير مانجو")) { Id = 11 },
    ];

    private static ExtractedItem Item(string en, string ar, decimal price, string descEn = "", string descAr = "")
        => new($"{en} .... {price}", en, ar, descEn, descAr, price);

    [TestMethod]
    public void Sections_match_categories_by_id_or_by_name_and_items_already_on_the_menu_are_flagged()
    {
        var extraction = new MenuExtraction(
            [
                new ExtractedCategory("Hot Beverages", "مشروبات سخنة", 1, [Item("turkish  coffee", "قهوة تركي", 25), Item("Hibiscus", "كركديه", 20)]),
                new ExtractedCategory("Juices", "", 0, [Item("Orange Juice", "عصير برتقان", 40)]),
                new ExtractedCategory("Desserts", "حلويات", 0, [Item("Cheesecake", "تشيز كيك", 60, "New York style", "على الطريقة الأمريكية")]),
            ],
            "");

        var proposal = MenuProposalValidator.Validate(extraction, Categories, Items);

        Assert.HasCount(3, proposal.Categories);
        Assert.IsEmpty(proposal.Warnings, string.Join("; ", proposal.Warnings));
        Assert.IsNull(proposal.Notes);

        var hot = proposal.Categories[0];
        Assert.AreEqual(1, hot.CatalogTypeId, "by id");
        Assert.AreEqual("Hot Beverages", hot.Name.En);
        Assert.AreEqual(10, hot.Items[0].ExistingItemId, "Turkish Coffee is already on the menu, whatever the spacing and case");
        Assert.AreEqual("turkish coffee", hot.Items[0].Name.En, "cleaned, not re-cased: the user sees what was read");
        Assert.IsNull(hot.Items[1].ExistingItemId);

        Assert.AreEqual(5, proposal.Categories[1].CatalogTypeId, "by name when the model gave no id");
        Assert.IsNull(proposal.Categories[1].Name.Ar);

        var desserts = proposal.Categories[2];
        Assert.IsNull(desserts.CatalogTypeId, "a new category");
        Assert.AreEqual("New York style", desserts.Items[0].Description.En);
        Assert.AreEqual(60m, desserts.Items[0].Price);
    }

    [TestMethod]
    public void Unknown_ids_missing_prices_duplicates_and_empty_sections_become_warnings()
    {
        var extraction = new MenuExtraction(
            [
                new ExtractedCategory("Specials", "", 99, [Item("Lemonade", "ليمون", 0), Item("Lemonade", "ليمونادة", 30), Item("", "", 10), Item("Gold Latte", "", 50_000)]),
                new ExtractedCategory("Empty", "", 0, []),
                new ExtractedCategory("", "", 0, [Item("Ghost", "", 5)]),
            ],
            "The bottom of the photo is cut off.");

        var proposal = MenuProposalValidator.Validate(extraction, Categories, Items);

        var specials = Assert.ContainsSingle(proposal.Categories);
        Assert.IsNull(specials.CatalogTypeId);
        Assert.HasCount(2, specials.Items, "the duplicate and the nameless line are dropped");
        Assert.AreEqual(0m, specials.Items[0].Price);
        Assert.AreEqual("The bottom of the photo is cut off.", proposal.Notes);

        var warnings = string.Join("\n", proposal.Warnings);
        Assert.Contains("does not exist", warnings);
        Assert.Contains("Specials, line 1: no price", warnings);
        Assert.Contains("appears twice", warnings);
        Assert.Contains("line 3: no readable name", warnings);
        Assert.Contains("50000 looks wrong", warnings);
        Assert.Contains("Empty: no items", warnings);
        Assert.Contains("Section 3 has no readable name", warnings);
    }

    [TestMethod]
    public void Nothing_readable_is_said_plainly()
    {
        var proposal = MenuProposalValidator.Validate(new MenuExtraction([], "Not a menu."), Categories, Items);

        Assert.IsEmpty(proposal.Categories);
        Assert.Contains("Nothing on the photo could be read as a menu item.", proposal.Warnings);
        Assert.AreEqual("Not a menu.", proposal.Notes);
    }

    [TestMethod]
    public void Keys_fold_case_spacing_and_arabic_marks()
    {
        Assert.AreEqual("turkish coffee", MenuProposalValidator.Key("  Turkish   COFFEE "));
        Assert.AreEqual("قهوة تركي", MenuProposalValidator.Key("قَهْوَة تُرْكِي"));
        Assert.AreEqual("شاي", MenuProposalValidator.Key("شـــاي"));
    }
}
