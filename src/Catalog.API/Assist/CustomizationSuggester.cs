using System.Text.Json;
using Chillax.AI.Agents;
using Chillax.AI.Json;
using Microsoft.Extensions.AI;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// Proposes the customization groups for one menu item, in the house's own
/// wording: the rest of the menu's groups go along as examples. One agent
/// call per request; the answer is checked by
/// <see cref="CustomizationsPostProcessor"/> before it leaves.
/// </summary>
public sealed class CustomizationSuggester(IChillaxAgentFactory factory)
{
    public const string AgentKey = "customization-suggester";

    /// <summary>How many of the menu's existing groups ride along as examples.</summary>
    public const int MaxExamples = 12;

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Customization suggester",
        "Proposes the size, sugar, milk and extras groups a café menu item is ordered with",
        Instructions,
        Temperature: 0.4f,
        MaxOutputTokens: 2048,
        Timeout: TimeSpan.FromSeconds(45));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    /// <param name="item">With its category and its current customizations loaded.</param>
    /// <param name="examples">Groups from other items, each with the item it belongs to loaded.</param>
    public async Task<SuggestCustomizationsResponse> SuggestAsync(CatalogItem item, IReadOnlyList<ItemCustomization> examples, CancellationToken ct)
    {
        var prompt = new CustomizationsPrompt(
            Item: new CustomizationsItem(
                Pair(item.Name),
                Pair(item.Description),
                item.CatalogType is null ? string.Empty : $"{item.CatalogType.Name.En} / {item.CatalogType.Name.Ar}",
                item.Price),
            ExistingGroups: item.Customizations.OrderBy(c => c.DisplayOrder).Select(c => Label(c.Name)).ToList(),
            Examples: PickExamples(examples).Select(c => new CustomizationExample(Label(c.CatalogItem?.Name ?? new LocalizedText()), ToResult(c))).ToList());

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<CustomizationsResult>(messages, ct);
        return CustomizationsPostProcessor.Apply(run.Result, item);
    }

    /// <summary>
    /// A spread of the menu's groups rather than the first item's five: one
    /// per distinct wording (name plus options), in the order given, up to
    /// <see cref="MaxExamples"/>.
    /// </summary>
    public static IReadOnlyList<ItemCustomization> PickExamples(IReadOnlyList<ItemCustomization> candidates)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var picked = new List<ItemCustomization>();
        foreach (var group in candidates)
        {
            var shape = group.Name.En + "|" + string.Join(",", group.Options.OrderBy(o => o.DisplayOrder).Select(o => o.Name.En));
            if (seen.Add(shape))
                picked.Add(group);
            if (picked.Count == MaxExamples)
                break;
        }
        return picked;
    }

    private static CustomizationGroupResult ToResult(ItemCustomization group) => new(
        Pair(group.Name),
        group.IsRequired,
        group.AllowMultiple,
        group.Options.OrderBy(o => o.DisplayOrder).Select(o => new CustomizationOptionResult(Pair(o.Name), o.PriceAdjustment, o.IsDefault)).ToList());

    private static LocalizedPair Pair(LocalizedText text) => new(text.En ?? string.Empty, text.Ar ?? string.Empty);

    private static string Label(LocalizedText text) => string.IsNullOrWhiteSpace(text.Ar) ? text.En : $"{text.En} / {text.Ar}";

    private const string Instructions = $"""
        #agent: {AgentKey}
        You propose the customization groups a customer picks from when ordering one item from the menu of a café in
        Egypt: size, sugar level, roast, milk, type, flavor, extras. The user message is a JSON object with the item
        (name, description, category, price in Egyptian pounds), the names of the groups the item already has, and
        examples of groups from other items on the same menu.

        Rules:
        - Propose only what makes sense for this item: a Turkish coffee gets roast, sugar and cup; a juice gets size
          and ice; a bottled drink or a slice of cake may need nothing — then answer with an empty groups list.
        - Follow the examples: their voice, their wording, their prices. Reuse an example group as it is when it fits
          the item instead of inventing a new wording. Arabic is Egyptian café Arabic ("سنجل", "دبل", "مضبوط",
          "على الريحة", "زيادة", "من غير سكر"); English names are short Title Case ("Single", "Oat Milk").
        - Do not propose a group the item already has. At most 5 groups. A single-choice group has 2 to 6 options;
          an extras group (allowMultiple true) has 1 to 8.
        - isRequired is true only when the customer must choose, such as a size. allowMultiple is true only for
          add-ons the customer can stack.
        - A single-choice group has exactly one default option, the plain or standard choice. Add-ons have no default.
        - priceAdjustment is in Egyptian pounds on top of the item price: 0 for the standard choice, a round number
          in line with the examples and the item's price for a bigger size or an add-on. Never negative.
        - notes is normally an empty string; use it only when the item does not look like a menu item.
        - Answer with the JSON object only.
        """;
}
