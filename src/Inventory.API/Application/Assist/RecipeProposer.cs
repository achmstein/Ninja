#nullable enable
using System.Text.Json;
using Chillax.AI.Agents;
using Chillax.AI.Json;
using Chillax.Inventory.API.Application.Queries;
using Microsoft.Extensions.AI;

namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// Proposes what one sale of each of a batch of menu items takes off the
/// shelf: which are sold as a unit, which are recipes, and the ingredients
/// the shelf is still missing. One text call per batch; the answer goes
/// through <see cref="RecipeProposalValidator"/> before anyone sees it.
/// </summary>
public sealed class RecipeProposer(IChillaxAgentFactory factory)
{
    public const string AgentKey = "recipe-proposer";

    /// <summary>Menu items per call; the review sheet sends a long menu in batches.</summary>
    public const int MaxItems = 30;

    /// <summary>More shelf items than this and the rest are left to the picker.</summary>
    public const int MaxShelf = 500;

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Recipe proposer",
        "Proposes the stock rule (unit or recipe) for a batch of menu items, with the ingredients the shelf is missing",
        Instructions,
        Temperature: 0f,
        MaxOutputTokens: 8192,
        Timeout: TimeSpan.FromSeconds(90));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    public async Task<RecipesProposal> ProposeAsync(IReadOnlyList<MenuItemToTrack> items, IReadOnlyList<StockItemView> shelf, CancellationToken ct)
    {
        var warnings = new List<string>();
        var candidates = shelf;
        if (candidates.Count > MaxShelf)
        {
            candidates = candidates.Take(MaxShelf).ToList();
            warnings.Add($"Only the first {MaxShelf} stock items were offered to the assistant; the rest are still in the picker.");
        }

        var prompt = new RecipesPrompt(
            items.Select(i => new PromptMenuItem(
                i.CatalogItemId, i.Name.En, i.Name.Ar ?? string.Empty,
                i.Description?.En ?? string.Empty, i.Category ?? string.Empty, i.Price,
                (i.Options ?? []).Select(o => new PromptOption(o.Id, o.Group, o.Name.En, o.Name.Ar ?? string.Empty)).ToList())).ToList(),
            candidates.Select(c => new CandidateItem(c.Id, c.Name.En, c.Name.Ar ?? string.Empty, c.Unit, c.PackSize ?? 0, c.PackName ?? string.Empty)).ToList());

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<RecipesExtraction>(messages, ct);
        return RecipeProposalValidator.Validate(run.Result, items, candidates, warnings);
    }

    private const string Instructions = $"""
        #agent: {AgentKey}
        You set up stock tracking for the menu of a café in Egypt (coffee, tea, juices, soft drinks, shisha, snacks,
        desserts). The user message is a JSON object with "items" (menu items: id, English and Arabic name, description,
        category, price in EGP, and their customization options with id, group and name) and "shelf" (the stock items
        already tracked: id, names, base unit, pack size and pack name).

        For every item answer one entry in "recipes" with its catalogItemId and:
        - kind "unit" when a sale is one whole stock item that is bought as such (a can of soda, a bottle of water, a
          packaged snack, a shisha head sold as one) — then lines is empty; the item itself becomes the stock item.
        - kind "recipe" when a sale is made from ingredients: lines of what ONE sale takes, per unit sold, in the
          ingredient's base unit. Use realistic café quantities: an espresso 18 g of beans; a latte 18 g beans and
          200 ml milk; a Turkish coffee 7 g coffee and 5 g sugar; a tea one tea bag (1 pcs) and 200 ml water is not
          tracked (skip water); a fresh juice 300 g of fruit; a slice of cake 1 pcs of the cake slice. Include the
          cup or packaging only when it is worth counting (takeaway cups, lids, straws): at most one such line.
        - A line names either stockItemId (an id from the shelf, when the shelf already has that ingredient) or
          newItemKey (an ingredient from "newItems"), never both; the other is 0 / "".
        - optionIds is empty for the base recipe. When an option changes the ingredients (oat milk instead of milk,
          a large size that takes more, an extra shot), add a line with that option's id; keep the base line for the
          standard choice. Never invent option ids.
        - "newItems": every ingredient not on the shelf, once, with a short lowercase key ("whole-milk"), nameEn
          (Title Case), nameAr (Egyptian Arabic), unit (g for anything weighed, ml for poured, pcs for counted),
          packSize (base units per pack as bought: a 1 l carton of milk is 1000, a 250 g bag of beans 250; 0 when
          bought loose) and packName ("carton", "bag", "bottle", ""), autoSoldOut true only for things sold by the
          piece. Reuse one key across every recipe that needs it. Do not repeat anything already on the shelf; use
          its id instead.
        - notes is "" unless the items do not look like a menu.
        - Answer with the JSON object only.
        """;
}
