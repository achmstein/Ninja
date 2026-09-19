using System.Text.Json;
using Ninja.AI.Fake;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// What the localizer answers under test: the source text marked as fake
/// in the other language, a description written as "{name} description"
/// in both languages when one is asked for, and the first category when
/// one is asked for. Deterministic, so the E2E suite can assert on it.
/// </summary>
public static class MenuLocalizerFake
{
    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<LocalizePrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The localizer prompt is not the expected JSON");

        var fill = prompt.Fill.ToHashSet(StringComparer.Ordinal);
        var name = Fill(prompt.Name, fill.Contains(LocalizerPostProcessor.NameEn), fill.Contains(LocalizerPostProcessor.NameAr));
        var description = fill.Contains(LocalizerPostProcessor.DescriptionEn) && fill.Contains(LocalizerPostProcessor.DescriptionAr)
            ? Write(prompt.Name)
            : Fill(prompt.Description, fill.Contains(LocalizerPostProcessor.DescriptionEn), fill.Contains(LocalizerPostProcessor.DescriptionAr));

        var result = new LocalizeResult(
            name,
            description,
            fill.Contains(LocalizerPostProcessor.CategoryId) ? prompt.Categories.Select(c => c.Id).FirstOrDefault() : 0,
            string.Empty);

        return JsonSerializer.Serialize(result, AIJson.Options);
    }

    /// <summary>The other language is the source text with a marker.</summary>
    private static LocalizedPair Fill(LocalizedPair pair, bool en, bool ar)
        => new(
            en ? $"{pair.Ar} (fake)" : pair.En,
            ar ? $"{pair.En} (تجريبي)" : pair.Ar);

    /// <summary>A description from nothing but the name.</summary>
    private static LocalizedPair Write(LocalizedPair name)
    {
        var source = name.En.Length > 0 ? name.En : name.Ar;
        return new LocalizedPair($"{source} description (fake)", $"وصف {source} (تجريبي)");
    }
}
