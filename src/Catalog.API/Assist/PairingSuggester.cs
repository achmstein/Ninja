using System.Text.Json;
using Ninja.AI.Agents;
using Ninja.AI.Json;
using Microsoft.Extensions.AI;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Proposes what to suggest alongside an item: the menu goes along, with
/// what the item is bought with on real tickets and the owner's other lists
/// as examples of their taste. One agent call per request; the answer is
/// checked by <see cref="PairingsPostProcessor"/> before it leaves.
/// </summary>
public sealed class PairingSuggester(INinjaAgentFactory factory)
{
    public const string AgentKey = "pairing-suggester";

    /// <summary>How many of the menu's other lists ride along as examples.</summary>
    public const int MaxExamples = 8;

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Pairing suggester",
        "Proposes the items to suggest alongside one on the menu",
        Instructions,
        Temperature: 0.3f,
        MaxOutputTokens: 1024,
        Timeout: TimeSpan.FromSeconds(30));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    /// <param name="item">The item, with its category loaded.</param>
    /// <param name="menu">The items that can be ordered now, categories loaded; the item itself may be among them.</param>
    /// <param name="lists">Other items' pairings, each with both items loaded, in the owner's order.</param>
    public async Task<SuggestPairingsResponse> SuggestAsync(
        SuggestPairingsRequest request,
        CatalogItem item,
        IReadOnlyList<CatalogItem> menu,
        IReadOnlyList<CatalogItemPairing> lists,
        CancellationToken ct)
    {
        var orderable = menu.Where(i => i.Id != item.Id).ToList();
        var prompt = new PairingsPrompt(
            Item: Item(item),
            Menu: orderable.Select(Item).ToList(),
            AlreadySuggested: (request.Current ?? []).Distinct().ToList(),
            BoughtWith: new PairingsSales(request.TicketsWithItem, request.Together ?? []),
            Examples: PickExamples(lists, item.Id),
            Room: PairingsPostProcessor.Room(request),
            Languages: ContentLanguages.Normalize(request.Languages),
            Note: request.Note?.Trim() ?? string.Empty);

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<PairingsResult>(messages, ct);
        return PairingsPostProcessor.Apply(run.Result, request, orderable.Select(i => i.Id).ToHashSet());
    }

    /// <summary>Up to <see cref="MaxExamples"/> other items' lists, as names, in the order given.</summary>
    internal static IReadOnlyList<PairingsExample> PickExamples(IReadOnlyList<CatalogItemPairing> lists, int itemId) =>
        lists
            .Where(p => p.CatalogItemId != itemId)
            .GroupBy(p => p.CatalogItemId)
            .Take(MaxExamples)
            .Select(g => new PairingsExample(
                g.First().CatalogItem.Name.Both,
                g.OrderBy(p => p.DisplayOrder).Select(p => p.PairedItem.Name.Both).ToList()))
            .ToList();

    private static PairingsMenuItem Item(CatalogItem item) =>
        new(item.Id, item.Name.Both, item.CatalogType?.Name.Both ?? string.Empty, item.Price);

    private const string Instructions = $"""
        #agent: {AgentKey}
        You propose the items a café, restaurant or kitchen in Egypt suggests alongside one on its menu: the customer
        app shows them on the item and nudges one in the cart, and the till offers them after the item is rung up. The
        user message is a JSON object with the item (id, name, category, price in Egyptian pounds), the menu (every
        other item that can be ordered now), "alreadySuggested" (ids on the item's list already), "boughtWith" (real
        sales: of "ticketsWithItem" settled tickets that had the item, how many also had each other item), "examples"
        (the owner's lists for other items), "room" (how many to propose at most), "languages", and "note": the
        owner's own instructions, often empty.
        {ContentLanguages.PromptRule}
        Rules:
        - When "note" has text, it comes first: propose what it asks for and leave out what it says to leave out. It
          may be in Arabic or English; the reasons still follow "languages".
        - Propose what completes the order, not a near-copy: a drink with food, a pastry or dessert with coffee, a
          side or a sauce with a main, a shisha flavour or snack with a session. Never another item of the same kind
          (no second latte with a latte) and never a different size of the item itself.
        - Real sales come first: an item often on the same ticket ("together" high against "ticketsWithItem") is a
          strong pick. With few tickets (under about 20) the counts say little; lean on the menu and the examples.
        - Follow the owner's taste in "examples": the kinds of item they pair and how far up the price they go.
          Prefer items priced at or below the item, unless the item is a drink or a snack.
        - Only ids from "menu", none from "alreadySuggested", each once, best first, at most "room".
        - reason is a few words a manager understands at a glance: "Bought together on 40% of its tickets",
          "A pastry to go with the coffee", "اتباعوا مع بعض في ٤٠٪ من الطلبات", "حلو مع القهوة".
        - When nothing on the menu fits, answer with an empty items list and say why in notes; otherwise notes is "".
        - Answer with the JSON object only.
        """;
}
