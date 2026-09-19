#nullable enable
using Ninja.Inventory.API.Application.Assist;
using Ninja.Inventory.API.Application.Queries;
using Ninja.Inventory.Domain.SeedWork;

namespace Inventory.UnitTests.Application;

[TestClass]
public class StockItemMatcherTest
{
    private static readonly List<StockItemView> Items =
    [
        new(1, new LocalizedText("Sugar", "سكر"), "g", 1000, "bag", false, true),
        new(2, new LocalizedText("Whole Milk", "لبن كامل الدسم"), "ml", 1000, "carton", false, true),
        new(3, new LocalizedText("Red Bull", "ريد بول"), "pcs", null, null, true, true),
        new(4, new LocalizedText("Turkish Coffee Beans", "بن تركي"), "g", 250, "pack", false, true),
    ];

    [TestMethod]
    public void Normalizes_arabic_forms_and_digits()
    {
        Assert.AreEqual("سكر", StockItemMatcher.Normalize("سُكَّر"));
        Assert.AreEqual("لبن كامل الدسم", StockItemMatcher.Normalize("لبن كامل الدسمة").Replace("الدسمه", "الدسم"), "ta marbuta becomes ha");
        Assert.AreEqual("اسبرسو", StockItemMatcher.Normalize("إسبرسو"));
        Assert.AreEqual("12 قهوه", StockItemMatcher.Normalize("١٢ قهوة"));
        Assert.AreEqual("cafe creme 2", StockItemMatcher.Normalize("Café Crème (2)"));
    }

    [TestMethod]
    public void Suggests_by_english_or_arabic_name()
    {
        CollectionAssert.AreEqual(new[] { 1 }, StockItemMatcher.Suggest("سكر ناعم 1 كيلو", Items).ToList());
        CollectionAssert.AreEqual(new[] { 2 }, StockItemMatcher.Suggest("Juhayna whole milk 1L x 6", Items).ToList());
        CollectionAssert.AreEqual(new[] { 3 }, StockItemMatcher.Suggest("RED BULL 250ML", Items).ToList());
    }

    [TestMethod]
    public void Nothing_close_means_no_suggestion()
    {
        Assert.IsEmpty(StockItemMatcher.Suggest("Paper cups 12oz", Items));
        Assert.IsEmpty(StockItemMatcher.Suggest("   ", Items));
    }

    [TestMethod]
    public void Better_matches_come_first_and_the_list_is_capped()
    {
        var suggestions = StockItemMatcher.Suggest("turkish coffee", Items, take: 2, minScore: 0.05);

        Assert.AreEqual(4, suggestions[0]);
        Assert.IsLessThanOrEqualTo(2, suggestions.Count);
    }
}
