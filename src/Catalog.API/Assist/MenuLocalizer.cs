using System.Text.Json;
using Ninja.AI.Agents;
using Ninja.AI.Json;
using Microsoft.Extensions.AI;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Fills in what a menu text is missing — the other language, a description
/// written from the name, a category — in the voice the seed menu already
/// speaks. One agent call per request; the answer is cleaned and checked by
/// <see cref="LocalizerPostProcessor"/> before it leaves.
/// </summary>
public sealed class MenuLocalizer(INinjaAgentFactory factory)
{
    public const string AgentKey = "menu-localizer";

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Menu localizer",
        "Fills in the English or Arabic side of a café menu text, writes a description, picks a category",
        Instructions,
        Temperature: 0.3f,
        MaxOutputTokens: 512,
        Timeout: TimeSpan.FromSeconds(30));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    public async Task<LocalizeResponse> LocalizeAsync(LocalizeRequest request, IReadOnlyList<CatalogType> categories, CancellationToken ct)
    {
        var category = request.CatalogTypeId is { } typeId ? categories.FirstOrDefault(c => c.Id == typeId) : null;

        var prompt = new LocalizePrompt(
            Kind: request.Kind.ToString(),
            Fill: LocalizerPostProcessor.FieldsToFill(request),
            Name: Pair(request.Name),
            Description: request.Description is null ? new LocalizedPair(string.Empty, string.Empty) : Pair(request.Description),
            Category: category is null ? string.Empty : $"{category.Name.En} / {category.Name.Ar}",
            Categories: request.SuggestCategory
                ? categories.Select(c => new CategoryOption(c.Id, c.Name.En, c.Name.Ar ?? string.Empty)).ToList()
                : []);

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
        You complete texts for the menu of a café in Egypt. The user message is a JSON object with the kind of text
        (MenuItem, Category or StockItem), a "fill" list naming exactly the fields you must produce, the name and
        description as typed so far (some sides empty), the item's category as context, and, when a category is
        wanted, a list of categories to choose from.

        Rules:
        - Produce exactly the fields in "fill". Copy every other field back UNCHANGED, character for character;
          a field that is empty and not in "fill" stays empty.
        - "name.ar" / "name.en": the name in the other language. "description.ar" / "description.en" alone: the
          description in the other language, saying the same thing.
        - Both "description.en" and "description.ar" together: there is no description yet, write one from the name
          and category — what it is and how it is made or served, one plain sentence, at most 15 words, the same
          meaning in both languages. Nothing the name does not imply: no origins, no health claims, no "best".
        - Arabic is Egyptian café Arabic, the way the menu already reads: "قهوة تركي", "شاي مصري تقليدي، زي ما بتحبه",
          "قهوتنا التركي المميزة، محمصة طازة كل يوم", "مشروبات مثلجة", "مقرمشات". Prefer everyday words
          (زي، بتحبه، طازة) over formal ones (مثل، تفضله، طازجة).
        - English is Title Case for names ("Turkish Coffee", "Iced Latte") and a plain short sentence for descriptions.
        - Brand and drink names are transliterated, not translated: Nescafe → نسكافيه, Red Bull → ريد بول, Latte → لاتيه.
        - Never add prices, sizes, calories or promotions. Never invent ingredients that are not in the source.
        - Names are at most 5 words; descriptions at most 15 words.
        - "categoryId": set suggestedCategoryId to the id of the most fitting category from the list, otherwise 0.
          Never pick an id that is not in the list.
        - notes is normally an empty string; use it only when the source is gibberish or not a menu text.
        - Answer with the JSON object only.
        """;
}
