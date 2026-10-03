using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class MenuProposalValidatorTest
{
    private static readonly List<MenuEntry> Categories =
    [
        new(1, new LocalizedText("Hot Drinks", "مشروبات سخنة")),
        new(5, new LocalizedText("Juices", "عصائر")),
    ];

    private static readonly List<MenuEntry> Items =
    [
        new(10, new LocalizedText("Turkish Coffee", "قهوة تركي")),
        new(11, new LocalizedText("Mango Juice", "عصير مانجو")),
    ];

    private static ExtractedItem Item(string en, string ar, decimal price, string descEn = "", string descAr = "")
        => new($"{en} .... {price}", en, ar, descEn, descAr, price, "", "", []);

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

    [TestMethod]
    public void Printed_sizes_become_a_choice_cheapest_first_and_the_item_costs_the_cheapest()
    {
        var latte = new ExtractedItem("Latte S 40 M 45 L 50", "Latte", "لاتيه", "", "", 45, "", "",
            [new("Large", "كبير", 50), new("Small", "صغير", 40), new("Medium", "وسط", 45), new("medium", "", 45)]);
        var extraction = new MenuExtraction([new ExtractedCategory("Coffee", "", 0, [latte])], "");

        var item = MenuProposalValidator.Validate(extraction, Categories, Items).Categories[0].Items[0];

        Assert.AreEqual(40m, item.Price);
        Assert.AreEqual("Size", item.Choice!.Name.En, "an unnamed choice is a size");
        Assert.AreEqual("الحجم", item.Choice.Name.Ar);
        CollectionAssert.AreEqual(new[] { "Small", "Medium", "Large" }, item.Choice.Options.Select(o => o.Name.En).ToList(), "the repeated Medium is dropped");
    }

    [TestMethod]
    public void One_readable_choice_is_no_choice()
    {
        var shot = new ExtractedItem("Espresso 30 / ?", "Espresso", "", "", "", 30, "Shot", "الشوت",
            [new("Single", "سنجل", 30), new("Double", "دبل", 0)]);
        var extraction = new MenuExtraction([new ExtractedCategory("Coffee", "", 0, [shot])], "");

        var proposal = MenuProposalValidator.Validate(extraction, Categories, Items);

        var item = proposal.Categories[0].Items[0];
        Assert.IsNull(item.Choice);
        Assert.AreEqual(30m, item.Price);
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("\"Double\"")), string.Join("; ", proposal.Warnings));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("only one price is kept")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void An_arabic_only_business_gets_arabic_names_only_and_no_nudge_about_english()
    {
        var latte = new ExtractedItem("لاتيه 40 / 50", "Latte", "لاتيه", "Espresso and milk", "إسبريسو ولبن", 40, "", "",
            [new("Small", "صغير", 40), new("Large", "كبير", 50)]);
        // The model put this one's Arabic on the English side: it still belongs to the business
        var tea = new ExtractedItem("شاي 15", "شاي", "", "", "", 15, "", "", []);
        var extraction = new MenuExtraction([new ExtractedCategory("Hot Drinks", "مشروبات سخنة", 1, [latte, tea])], "");

        var proposal = MenuProposalValidator.Validate(extraction, Categories, Items, "ar");

        var section = proposal.Categories.Single();
        Assert.IsNull(section.Name.En);
        Assert.AreEqual("مشروبات سخنة", section.Name.Ar);
        var item = section.Items[0];
        Assert.IsNull(item.Name.En);
        Assert.AreEqual("لاتيه", item.Name.Ar);
        Assert.IsNull(item.Description.En);
        Assert.AreEqual("إسبريسو ولبن", item.Description.Ar);
        Assert.IsNull(item.Choice!.Name.En, "the unnamed size is named in Arabic only");
        Assert.AreEqual("الحجم", item.Choice.Name.Ar);
        Assert.IsTrue(item.Choice.Options.All(o => o.Name.En is null));
        Assert.AreEqual("شاي", section.Items[1].Name.Ar);
        Assert.IsNull(section.Items[1].Name.En);
        Assert.IsFalse(proposal.Warnings.Any(w => w.Contains("English")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void An_english_only_business_keeps_an_arabic_only_line_and_says_it_needs_english()
    {
        var extraction = new MenuExtraction(
            [new ExtractedCategory("Juices", "عصائر", 5, [Item("Orange Juice", "عصير برتقان", 40), Item("", "كركديه", 20)])],
            "");

        var proposal = MenuProposalValidator.Validate(extraction, Categories, Items, "en");

        var items = proposal.Categories.Single().Items;
        Assert.AreEqual("Orange Juice", items[0].Name.En);
        Assert.IsNull(items[0].Name.Ar);
        Assert.AreEqual("كركديه", items[1].Name.Ar, "a name in the other script is kept rather than lost");
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("no English name")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void Options_left_in_brackets_after_a_name_become_a_choice_at_its_price()
    {
        var extraction = new MenuExtraction(
            [
                new ExtractedCategory("Desserts", "حلويات", 0,
                [
                    Item("Volcano (Lotus / Nutella / Mango)", "بركان (لوتس / نوتيلا / مانجو)", 85),
                    Item("Espresso (Double)", "إسبريسو (دبل)", 40),
                ]),
            ],
            "");

        var items = MenuProposalValidator.Validate(extraction, Categories, Items).Categories[0].Items;

        var volcano = items[0];
        Assert.AreEqual("Volcano", volcano.Name.En);
        Assert.AreEqual("بركان", volcano.Name.Ar);
        Assert.AreEqual(85m, volcano.Price);
        Assert.IsNotNull(volcano.Choice);
        CollectionAssert.AreEqual(new[] { "Lotus", "Nutella", "Mango" }, volcano.Choice.Options.Select(o => o.Name.En).ToArray());
        CollectionAssert.AreEqual(new[] { "لوتس", "نوتيلا", "مانجو" }, volcano.Choice.Options.Select(o => o.Name.Ar).ToArray());
        Assert.IsTrue(volcano.Choice.Options.All(o => o.Price == 85m), "one price for every option");

        // One thing in brackets is part of the name
        Assert.AreEqual("Espresso (Double)", items[1].Name.En);
        Assert.IsNull(items[1].Choice);
    }

    [TestMethod]
    public void Options_in_one_language_only_name_the_choice_in_that_language()
    {
        var item = MenuProposalValidator.SplitPrintedChoices(Item("Volcano", "بركان (لوتس، نوتيلا، مانجو)", 85));

        Assert.AreEqual("بركان", item.NameAr);
        Assert.AreEqual("Volcano", item.NameEn);
        Assert.HasCount(3, item.Choices);
        Assert.AreEqual("نوتيلا", item.Choices[1].NameAr);
        Assert.AreEqual("", item.Choices[1].NameEn);
    }
}
