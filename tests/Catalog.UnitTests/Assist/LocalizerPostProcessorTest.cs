using Chillax.Catalog.API.Assist;
using Chillax.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class LocalizerPostProcessorTest
{
    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Coffee", "قهوة")) { Id = 1 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5 },
    ];

    private static LocalizeRequest EnglishItem(string en = "Turkish Coffee", string? descriptionEn = "Roasted fresh daily", bool suggest = false)
        => new(LocalizeKind.MenuItem, new LocalizedText(en), descriptionEn is null ? null : new LocalizedText(descriptionEn), 1, suggest);

    [TestMethod]
    public void Fills_the_arabic_side_and_keeps_the_english_verbatim()
    {
        var result = new LocalizeResult(
            new LocalizedPair("turkish coffee", "  قهوة   تركي "),
            new LocalizedPair("changed", "محمصة طازة كل يوم"),
            0, string.Empty);

        var response = LocalizerPostProcessor.Apply(EnglishItem(), result, Categories);

        Assert.AreEqual("Turkish Coffee", response.Name.En, "the source side is the user's text, not the model's echo");
        Assert.AreEqual("قهوة تركي", response.Name.Ar);
        Assert.AreEqual("Roasted fresh daily", response.Description!.En);
        Assert.AreEqual("محمصة طازة كل يوم", response.Description.Ar);
        CollectionAssert.AreEqual(new[] { "name.ar", "description.ar" }, response.Filled.ToList());
        Assert.IsEmpty(response.Warnings);
        Assert.IsNull(response.SuggestedCatalogTypeId);
    }

    [TestMethod]
    public void Fills_the_english_side_from_arabic()
    {
        var request = new LocalizeRequest(LocalizeKind.Category, new LocalizedText(string.Empty, "مشروبات مثلجة"));
        var result = new LocalizeResult(new LocalizedPair("Iced Drinks", "مشروبات مثلجة"), new LocalizedPair("", ""), 0, "");

        var response = LocalizerPostProcessor.Apply(request, result, Categories);

        Assert.AreEqual("Iced Drinks", response.Name.En);
        Assert.AreEqual("مشروبات مثلجة", response.Name.Ar);
        CollectionAssert.AreEqual(new[] { "name.en" }, response.Filled.ToList());
        Assert.IsNull(response.Description);
    }

    [TestMethod]
    public void An_empty_answer_leaves_the_field_alone_and_warns()
    {
        var result = new LocalizeResult(new LocalizedPair("Turkish Coffee", ""), new LocalizedPair("Roasted fresh daily", ""), 0, "");

        var response = LocalizerPostProcessor.Apply(EnglishItem(), result, Categories);

        Assert.IsNull(response.Name.Ar);
        Assert.IsNull(response.Description!.Ar);
        Assert.IsEmpty(response.Filled);
        Assert.HasCount(2, response.Warnings);
    }

    [TestMethod]
    public void Price_wording_is_stripped_and_flagged()
    {
        var result = new LocalizeResult(new LocalizedPair("Turkish Coffee", "قهوة تركي 25 جنيه"), new LocalizedPair("", ""), 0, "");

        var response = LocalizerPostProcessor.Apply(EnglishItem(descriptionEn: null), result, Categories);

        Assert.AreEqual("قهوة تركي", response.Name.Ar);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("price")), string.Join("; ", response.Warnings));
        CollectionAssert.AreEqual(new[] { "name.ar" }, response.Filled.ToList());
    }

    [TestMethod]
    public void Arabic_without_arabic_letters_is_flagged_but_kept()
    {
        var result = new LocalizeResult(new LocalizedPair("Turkish Coffee", "Turkish Coffee"), new LocalizedPair("", ""), 0, "");

        var response = LocalizerPostProcessor.Apply(EnglishItem(descriptionEn: null), result, Categories);

        Assert.AreEqual("Turkish Coffee", response.Name.Ar);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("no Arabic letters")), string.Join("; ", response.Warnings));
    }

    [TestMethod]
    public void A_category_is_only_suggested_when_asked_and_when_it_exists()
    {
        var known = new LocalizeResult(new LocalizedPair("Mango Juice", "عصير مانجو"), new LocalizedPair("", ""), 5, "");
        var unknown = known with { SuggestedCategoryId = 99 };

        var asked = LocalizerPostProcessor.Apply(EnglishItem("Mango Juice", null, suggest: true), known, Categories);
        Assert.AreEqual(5, asked.SuggestedCatalogTypeId);
        Assert.Contains("catalogTypeId", asked.Filled);

        var notAsked = LocalizerPostProcessor.Apply(EnglishItem("Mango Juice", null), known, Categories);
        Assert.IsNull(notAsked.SuggestedCatalogTypeId);
        Assert.DoesNotContain("catalogTypeId", notAsked.Filled);

        var bogus = LocalizerPostProcessor.Apply(EnglishItem("Mango Juice", null, suggest: true), unknown, Categories);
        Assert.IsNull(bogus.SuggestedCatalogTypeId);
        Assert.IsTrue(bogus.Warnings.Any(w => w.Contains("does not exist")), string.Join("; ", bogus.Warnings));
    }

    [TestMethod]
    public void Notes_become_a_warning()
    {
        var result = new LocalizeResult(new LocalizedPair("asdfgh", "أسدفغه"), new LocalizedPair("", ""), 0, "This does not look like a menu item.");

        var response = LocalizerPostProcessor.Apply(EnglishItem("asdfgh", null), result, Categories);

        Assert.Contains("Assistant: This does not look like a menu item.", response.Warnings);
    }

    [TestMethod]
    public void A_description_is_written_in_both_languages_when_asked_for_and_absent()
    {
        var request = new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Mango Juice"), null, 5, SuggestDescription: true);
        var result = new LocalizeResult(
            new LocalizedPair("Mango Juice", "عصير مانجو"),
            new LocalizedPair("Fresh mango, blended to order.", "مانجو طازة، بتتخلط على طلبك."),
            0, "");

        var response = LocalizerPostProcessor.Apply(request, result, Categories);

        Assert.AreEqual("Fresh mango, blended to order.", response.Description!.En);
        Assert.AreEqual("مانجو طازة، بتتخلط على طلبك.", response.Description.Ar);
        CollectionAssert.AreEqual(new[] { "name.ar", "description.en", "description.ar" }, response.Filled.ToList());
        Assert.IsEmpty(response.Warnings);
    }

    [TestMethod]
    public void A_half_filled_description_is_translated_not_rewritten_even_when_writing_is_asked_for()
    {
        var request = new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Mango Juice"), new LocalizedText("Fresh mango"), 5, SuggestDescription: true);
        CollectionAssert.AreEqual(new[] { "name.ar", "description.ar" }, LocalizerPostProcessor.FieldsToFill(request).ToList());

        var result = new LocalizeResult(new LocalizedPair("Mango Juice", "عصير مانجو"), new LocalizedPair("Rewritten", "مانجو طازة"), 0, "");
        var response = LocalizerPostProcessor.Apply(request, result, Categories);

        Assert.AreEqual("Fresh mango", response.Description!.En, "the user's side is kept");
        Assert.AreEqual("مانجو طازة", response.Description.Ar);
    }

    [TestMethod]
    public void A_bilingual_name_is_left_alone_and_only_the_description_is_written()
    {
        var request = new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea", "شاي"), null, 1, SuggestDescription: true);
        CollectionAssert.AreEqual(new[] { "description.en", "description.ar" }, LocalizerPostProcessor.FieldsToFill(request).ToList());

        var result = new LocalizeResult(new LocalizedPair("Black Tea", "شاي أسود"), new LocalizedPair("Traditional Egyptian tea.", "شاي مصري تقليدي."), 0, "");
        var response = LocalizerPostProcessor.Apply(request, result, Categories);

        Assert.AreEqual("Tea", response.Name.En);
        Assert.AreEqual("شاي", response.Name.Ar);
        Assert.AreEqual("Traditional Egyptian tea.", response.Description!.En);
        CollectionAssert.AreEqual(new[] { "description.en", "description.ar" }, response.Filled.ToList());
    }

    [TestMethod]
    public void Validation_wants_a_name_something_to_fill_and_menu_items_only_for_descriptions()
    {
        Assert.IsNull(LocalizerPostProcessor.Validate(EnglishItem()));
        Assert.IsNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.StockItem, new LocalizedText("", "سكر"))));
        Assert.IsNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea", "شاي"), SuggestDescription: true)), "both names, a description to write");
        Assert.IsNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea", "شاي"), new LocalizedText("hot"))), "both names, a description to translate");
        Assert.IsNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea"), new LocalizedText("", ""))), "an empty description is fine");

        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea", "شاي"))), "both filled, nothing to do");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea", "شاي"), new LocalizedText("hot", "سخن"), SuggestDescription: true)), "everything filled");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("", ""))), "none filled");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.Category, new LocalizedText("Tea"), new LocalizedText("hot"))), "category with description");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.StockItem, new LocalizedText("Tea"), SuggestCategory: true)), "stock item with category");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.StockItem, new LocalizedText("Tea"), SuggestDescription: true)), "stock item with description");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Tea"), new LocalizedText("", "ساخن"))), "description in the other language");
        Assert.IsNotNull(LocalizerPostProcessor.Validate(new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText(new string('x', 121)))), "too long");
    }
}
