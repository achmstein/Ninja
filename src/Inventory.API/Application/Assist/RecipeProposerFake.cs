#nullable enable
using System.Text.Json;
using Chillax.AI.Fake;
using Chillax.AI.Json;

namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// What the proposer answers under test, whatever the menu: the first item
/// is sold as a unit; every other one is a recipe of the first shelf item
/// (when there is one) plus a new "Fake Syrup", with a line for the item's
/// first option when it has any. Deterministic, so the E2E suite can create
/// the syrup and set the recipes the way the review sheet would.
/// </summary>
public static class RecipeProposerFake
{
    public const string SyrupKey = "fake-syrup";
    public const string SyrupNameEn = "Fake Syrup";
    public const string SyrupNameAr = "سيرب تجريبي";
    public const decimal ShelfQuantity = 10m;
    public const decimal SyrupQuantity = 20m;
    public const decimal OptionQuantity = 5m;
    public const decimal ScaleFactor = 2m;

    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<RecipesPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The recipe prompt is not the expected JSON");

        var shelfId = prompt.Shelf.Count > 0 ? prompt.Shelf[0].Id : 0;
        var recipes = new List<ExtractedRecipe>();
        foreach (var (item, index) in prompt.Items.Select((item, index) => (item, index)))
        {
            if (index == 0)
            {
                recipes.Add(new ExtractedRecipe(item.Id, RecipeKinds.Unit, [], []));
                continue;
            }

            // Slot 1: the shelf's first item. Slot 2: the syrup, less of it for the first option.
            var lines = new List<ExtractedRecipeLine>();
            if (shelfId > 0)
                lines.Add(new ExtractedRecipeLine(shelfId, string.Empty, ShelfQuantity, [], 1, true));
            lines.Add(new ExtractedRecipeLine(0, SyrupKey, SyrupQuantity, [], 2, true));
            var scales = new List<ExtractedScale>();
            if (item.Options.Count > 0)
            {
                lines.Add(new ExtractedRecipeLine(0, SyrupKey, OptionQuantity, [item.Options[0].Id], 2, true));
                if (item.Options.Count > 1)
                    scales.Add(new ExtractedScale(item.Options[1].Id, ScaleFactor));
            }
            recipes.Add(new ExtractedRecipe(item.Id, RecipeKinds.Recipe, lines, scales));
        }

        var extraction = new RecipesExtraction(
            [new ExtractedIngredient(SyrupKey, SyrupNameEn, SyrupNameAr, "ml", 1000, "bottle", false)],
            recipes,
            string.Empty);

        return JsonSerializer.Serialize(extraction, AIJson.Options);
    }
}
