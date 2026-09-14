using System.Text.Json;
using Chillax.AI.Fake;
using Chillax.AI.Json;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// What the suggester answers under test, whatever the item: a required
/// "Size" with Single / Double and an optional "Extras" add-on group.
/// Deterministic, so the E2E suite can assert on it; the post-processor
/// still drops "Size" when the item already has one.
/// </summary>
public static class CustomizationSuggesterFake
{
    public static string Respond(FakeAgentRequest request)
    {
        _ = JsonSerializer.Deserialize<CustomizationsPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The suggester prompt is not the expected JSON");

        var result = new CustomizationsResult(
            [
                new CustomizationGroupResult(new LocalizedPair("Size", "الحجم"), IsRequired: true, AllowMultiple: false,
                [
                    new CustomizationOptionResult(new LocalizedPair("Single", "سنجل"), 0m, IsDefault: true),
                    new CustomizationOptionResult(new LocalizedPair("Double", "دبل"), 10m, IsDefault: false),
                ]),
                new CustomizationGroupResult(new LocalizedPair("Extras", "إضافات"), IsRequired: false, AllowMultiple: true,
                [
                    new CustomizationOptionResult(new LocalizedPair("Extra Shot", "شوت زيادة"), 10m, IsDefault: false),
                    new CustomizationOptionResult(new LocalizedPair("Whipped Cream", "كريمة"), 5m, IsDefault: false),
                ]),
            ],
            string.Empty);

        return JsonSerializer.Serialize(result, AIJson.Options);
    }
}
