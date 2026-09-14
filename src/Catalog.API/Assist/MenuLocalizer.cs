using System.Text.Json;
using Chillax.AI.Agents;
using Chillax.AI.Json;
using Microsoft.Extensions.AI;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// Fills in the missing language of a menu text in the voice the seed menu
/// already speaks. One agent call per request; the answer is cleaned and
/// checked by <see cref="LocalizerPostProcessor"/> before it leaves.
/// </summary>
public sealed class MenuLocalizer(IChillaxAgentFactory factory)
{
    public const string AgentKey = "menu-localizer";

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Menu localizer",
        "Fills in the English or Arabic side of a café menu text",
        Instructions,
        Temperature: 0.3f,
        MaxOutputTokens: 512,
        Timeout: TimeSpan.FromSeconds(30));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    public async Task<LocalizeResponse> LocalizeAsync(LocalizeRequest request, IReadOnlyList<CatalogType> categories, CancellationToken ct)
    {
        var sourceIsEnglish = !string.IsNullOrWhiteSpace(request.Name.En);
        var category = request.CatalogTypeId is { } typeId ? categories.FirstOrDefault(c => c.Id == typeId) : null;

        var prompt = new LocalizePrompt(
            Kind: request.Kind.ToString(),
            SourceLanguage: sourceIsEnglish ? "en" : "ar",
            TargetLanguage: sourceIsEnglish ? "ar" : "en",
            Name: Pair(request.Name),
            Description: request.Description is null ? new LocalizedPair(string.Empty, string.Empty) : Pair(request.Description),
            Category: category is null ? string.Empty : $"{category.Name.En} / {category.Name.Ar}",
            Categories: request.SuggestCategory
                ? categories.Select(c => new CategoryOption(c.Id, c.Name.En, c.Name.Ar ?? string.Empty)).ToList()
                : [],
            SuggestCategory: request.SuggestCategory);

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<LocalizeResult>(messages, ct);
        return LocalizerPostProcessor.Apply(request, run.Result, categories);
    }

    private static LocalizedPair Pair(LocalizedText text) => new(text.En ?? string.Empty, text.Ar ?? string.Empty);

    private const string Instructions = $"""
        #agent: {AgentKey}
        You localize texts for the menu of a café in Egypt. The user message is a JSON object with the kind of text
        (MenuItem, Category or StockItem), the source language, the target language, the name and description
        (one language filled in, the other empty), the item's category as context, and optionally a list of
        categories to choose from.

        Rules:
        - Fill in the target language of name and description. Copy the source language back UNCHANGED, character for character.
        - Arabic is Egyptian café Arabic, the way the menu already reads: "قهوة تركي", "شاي مصري تقليدي، زي ما بتحبه",
          "قهوتنا التركي المميزة، محمصة طازة كل يوم", "مشروبات مثلجة", "مقرمشات". Prefer everyday words
          (زي، بتحبه، طازة) over formal ones (مثل، تفضله، طازجة).
        - English is Title Case for names ("Turkish Coffee", "Iced Latte") and a plain short sentence for descriptions.
        - Brand and drink names are transliterated, not translated: Nescafe → نسكافيه, Red Bull → ريد بول, Latte → لاتيه.
        - Never add prices, sizes, calories or promotions. Never invent ingredients that are not in the source.
        - Names are at most 5 words; descriptions at most 15 words. An empty description stays empty on both sides.
        - The category is context for the wording only. Set suggestedCategoryId to the id of the most fitting category
          from the list when suggestCategory is true, otherwise 0. Never pick an id that is not in the list.
        - notes is normally an empty string; use it only when the source is gibberish or not a menu text.
        - Answer with the JSON object only.
        """;
}
