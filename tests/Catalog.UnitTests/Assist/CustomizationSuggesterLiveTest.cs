using System.Text.Json;
using System.Text.RegularExpressions;
using Chillax.AI.Json;
using Chillax.Catalog.API.Assist;
using Chillax.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

/// <summary>
/// The suggester against the real model. Opt in with GEMINI_API_KEY; one
/// request on the free tier, printed so the proposals can be judged by eye.
/// </summary>
[TestClass]
[TestCategory("Live")]
public class CustomizationSuggesterLiveTest
{
    [TestMethod]
    public async Task A_latte_gets_a_size_group_in_the_menu_voice()
    {
        var suggester = new CustomizationSuggester(LiveProvider.FactoryOrInconclusive());

        var coffee = new CatalogType(new LocalizedText("Coffee", "قهوة")) { Id = 1 };
        var latte = new SuggestCustomizationsRequest(
            new LocalizedText("Caramel Latte", "كراميل لاتيه"),
            new LocalizedText("Espresso, steamed milk and caramel", "إسبريسو ولبن وكراميل"),
            CatalogTypeId: coffee.Id,
            Price: 65m);

        // The seed's habits: Single / Double sizes, an Egyptian sugar scale
        var size = new ItemCustomization(new LocalizedText("Size", "الحجم")) { IsRequired = true, CatalogItem = new CatalogItem(new LocalizedText("Espresso", "إسبريسو")) };
        size.Options.Add(new CustomizationOption(new LocalizedText("Single", "سنجل")) { IsDefault = true, DisplayOrder = 1 });
        size.Options.Add(new CustomizationOption(new LocalizedText("Double", "دبل")) { PriceAdjustment = 15m, DisplayOrder = 2 });
        var sugar = new ItemCustomization(new LocalizedText("Sugar Level", "السكر")) { CatalogItem = new CatalogItem(new LocalizedText("Tea", "شاي")) };
        sugar.Options.Add(new CustomizationOption(new LocalizedText("No Sugar", "بدون سكر")) { DisplayOrder = 1 });
        sugar.Options.Add(new CustomizationOption(new LocalizedText("Medium Sugar", "مضبوط")) { IsDefault = true, DisplayOrder = 2 });
        sugar.Options.Add(new CustomizationOption(new LocalizedText("Sweet", "زيادة")) { DisplayOrder = 3 });

        var response = await suggester.SuggestAsync(latte, coffee, [size, sugar], CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(response, AIJson.Options));

        Assert.IsNotEmpty(response.Groups, "a latte should get at least a size");
        Assert.IsTrue(response.Groups.Any(g => Regex.IsMatch(g.Name.En, "(?i)size")), string.Join(", ", response.Groups.Select(g => g.Name.En)));
        Assert.IsTrue(response.Groups.All(g => Regex.IsMatch(g.Name.Ar ?? "", @"\p{IsArabic}")), "every group has an Arabic name");
        Assert.IsTrue(response.Groups.All(g => g.Options.All(o => o.PriceAdjustment >= 0)), "no discounts");
    }
}
