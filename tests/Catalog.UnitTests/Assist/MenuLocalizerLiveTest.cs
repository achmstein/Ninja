using System.Text.Json;
using System.Text.RegularExpressions;
using Chillax.AI.Json;
using Chillax.Catalog.API.Assist;
using Chillax.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

/// <summary>
/// The localizer against the real model. Opt in with GEMINI_API_KEY; each
/// test is one request on the free tier and prints what came back, so the
/// voice can be judged by eye.
/// </summary>
[TestClass]
[TestCategory("Live")]
public class MenuLocalizerLiveTest
{
    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Coffee", "قهوة")) { Id = 1, DisplayOrder = 1 },
        new(new LocalizedText("Iced Drinks", "مشروبات مثلجة")) { Id = 4, DisplayOrder = 4 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5, DisplayOrder = 5 },
        new(new LocalizedText("Desserts", "حلويات")) { Id = 8, DisplayOrder = 8 },
    ];

    [TestMethod]
    public async Task English_menu_item_gets_egyptian_arabic_and_a_category()
    {
        var localizer = new MenuLocalizer(LiveProvider.FactoryOrInconclusive());
        var request = new LocalizeRequest(LocalizeKind.MenuItem,
            new LocalizedText("Mango Juice"),
            new LocalizedText("Fresh mango, blended to order"),
            null, SuggestCategory: true);

        var response = await localizer.LocalizeAsync(request, Categories, CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(response, AIJson.Options));

        Assert.AreEqual("Mango Juice", response.Name.En);
        Assert.IsTrue(Regex.IsMatch(response.Name.Ar ?? "", @"\p{IsArabic}"), $"Arabic name expected, got '{response.Name.Ar}'");
        Assert.IsTrue(Regex.IsMatch(response.Description?.Ar ?? "", @"\p{IsArabic}"), $"Arabic description expected, got '{response.Description?.Ar}'");
        Assert.AreEqual(5, response.SuggestedCatalogTypeId, "Juices");
        CollectionAssert.IsSubsetOf(new[] { "name.ar", "description.ar" }, response.Filled.ToList());
    }

    [TestMethod]
    public async Task Arabic_stock_item_gets_english()
    {
        var localizer = new MenuLocalizer(LiveProvider.FactoryOrInconclusive());
        var request = new LocalizeRequest(LocalizeKind.StockItem, new LocalizedText(string.Empty, "لبن كامل الدسم"));

        var response = await localizer.LocalizeAsync(request, Categories, CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(response, AIJson.Options));

        Assert.AreEqual("لبن كامل الدسم", response.Name.Ar);
        Assert.IsTrue(Regex.IsMatch(response.Name.En, "(?i)milk"), $"English name expected, got '{response.Name.En}'");
        CollectionAssert.Contains(response.Filled.ToList(), "name.en");
    }
}
