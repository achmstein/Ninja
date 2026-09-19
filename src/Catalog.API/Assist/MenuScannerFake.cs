using System.Text.Json;
using Ninja.AI.Fake;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// What the scanner answers under test, whatever the pixels: a section
/// matched to the first existing category holding the seed's Turkish
/// Coffee (already on the menu) and a new drink, and a section nothing
/// matches with one described item. Deterministic, so the E2E suite can
/// create the category and the items the way the review sheet would.
/// </summary>
public static class MenuScannerFake
{
    public const string ExistingItemEn = "Turkish Coffee";
    public const string NewDrinkEn = "Fake Hibiscus";
    public const string NewCategoryEn = "Fake Specials";
    public const string NewSpecialEn = "Fake Mint Lemonade";

    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<MenuScanPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The menu scanner prompt is not the expected JSON");

        var first = prompt.Categories.FirstOrDefault();
        var extraction = new MenuExtraction(
            [
                new ExtractedCategory(first?.En ?? "Hot Drinks", first?.Ar ?? "مشروبات سخنة", first?.Id ?? 0,
                [
                    new ExtractedItem($"{ExistingItemEn} ........ 25", ExistingItemEn, "قهوة تركي", "", "", 25m),
                    new ExtractedItem($"{NewDrinkEn} ........ 20", NewDrinkEn, "كركديه تجريبي", "", "", 20m),
                ]),
                new ExtractedCategory(NewCategoryEn, "أصناف تجريبية", 0,
                [
                    new ExtractedItem($"{NewSpecialEn} ........ 30", NewSpecialEn, "ليمون بالنعناع تجريبي",
                        "Fresh lemon with mint, blended with ice", "ليمون طازة بالنعناع، مخلوط بالتلج", 30m),
                ]),
            ],
            string.Empty);

        return JsonSerializer.Serialize(extraction, AIJson.Options);
    }
}
