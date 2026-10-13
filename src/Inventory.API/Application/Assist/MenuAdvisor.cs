#nullable enable
using System.Text.Json;
using Ninja.AI.Agents;
using Ninja.AI.Json;
using Ninja.AI.Text;
using Microsoft.Extensions.AI;

namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// Reads the menu-engineering matrix and says what to change: which prices
/// to raise, which items to push up the menu, rework or take off. One text
/// call; only items the request named, each once, with a known move, come
/// back.
/// </summary>
public sealed class MenuAdvisor(INinjaAgentFactory factory)
{
    public const string AgentKey = "menu-advisor";

    /// <summary>Items per call: a menu is a short list, and a long one is cut at the biggest earners.</summary>
    public const int MaxItems = 150;

    public const int MaxNoteLength = 300;
    public const int MaxAdviceLength = 400;

    public static readonly string[] Classes = ["star", "plowhorse", "puzzle", "dog"];
    public static readonly string[] Actions = ["raise-price", "lower-price", "promote", "rework", "remove", "keep"];

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Menu advisor",
        "Says what to change on the menu from its menu-engineering matrix: prices, placement, recipes, items to drop",
        Instructions,
        Temperature: 0.3f,
        MaxOutputTokens: 4096,
        Timeout: TimeSpan.FromSeconds(60));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    /// <summary>The request is within its caps; the reason when not.</summary>
    public static string? Validate(MenuAdviceRequest request)
    {
        var items = request.Items ?? [];
        if (items.Count == 0)
            return "There is nothing placed on the matrix to advise on.";
        if (items.Count > MaxItems)
            return $"At most {MaxItems} items per call.";
        if (items.Any(d => d.CatalogItemId <= 0 || d.Name is null || d.Name.IsEmpty))
            return "Every item needs its id and a name.";
        if (items.Any(d => !Classes.Contains(d.Class)))
            return "Every item needs its class: star, plowhorse, puzzle or dog.";
        if ((request.Note?.Length ?? 0) > MaxNoteLength)
            return $"Keep the instructions under {MaxNoteLength} characters.";
        return null;
    }

    public async Task<MenuAdvice> AdviseAsync(MenuAdviceRequest request, CancellationToken ct)
    {
        var languages = ContentLanguages.Normalize(request.Languages);
        var totalSold = request.Items.Sum(d => d.Sold);
        var prompt = new MenuAdvicePrompt(
            request.Days,
            request.AverageMargin,
            PopularShare: request.Items.Count > 0 ? Math.Round(0.7m / request.Items.Count, 4) : 0,
            Items: request.Items.Select(d => new MenuAdvicePromptItem(
                d.CatalogItemId,
                d.Name.Both,
                d.Category?.Both ?? string.Empty,
                d.Price,
                d.Cost,
                d.Price - d.Cost,
                d.Price > 0 ? Math.Round(d.Cost / d.Price * 100, 1) : 0,
                d.Sold,
                totalSold > 0 ? Math.Round(d.Sold / totalSold, 4) : 0,
                d.Class)).ToList(),
            languages,
            request.Note?.Trim() ?? string.Empty);

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<MenuAdviceResult>(messages, ct);
        return Apply(run.Result, request, languages);
    }

    /// <summary>Only items the request named, each once, with a known move; text trimmed and kept in the business's languages.</summary>
    public static MenuAdvice Apply(MenuAdviceResult result, MenuAdviceRequest request, string languages)
    {
        var known = request.Items.Select(d => d.CatalogItemId).ToHashSet();
        var seen = new HashSet<int>();
        var warnings = new List<string>();
        var items = new List<ItemAdvice>();
        var skipped = 0;

        foreach (var item in result.Items ?? [])
        {
            var action = item.Action?.Trim().ToLowerInvariant() ?? string.Empty;
            if (!known.Contains(item.Id) || !seen.Add(item.Id) || !Actions.Contains(action))
            {
                skipped++;
                continue;
            }
            items.Add(new ItemAdvice(item.Id, action, Text(item.Advice, languages)));
        }

        if (skipped > 0)
            warnings.Add(skipped == 1
                ? "Skipped one piece of advice for a dish not on the matrix, given twice, or with an unknown move."
                : $"Skipped {skipped} pieces of advice for dishes not on the matrix, given twice, or with unknown moves.");
        if (!string.IsNullOrWhiteSpace(result.Notes))
            warnings.Add(result.Notes.Trim());

        return new MenuAdvice(Text(result.Summary, languages), items, warnings);
    }

    private static LocalizedText Text(LocalizedPair? pair, string languages)
    {
        var (en, ar) = ContentLanguages.Keep(Trim(pair?.En), Trim(pair?.Ar), languages);
        return new LocalizedText { En = en, Ar = ar };
    }

    private static string? Trim(string? text)
    {
        text = text?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        return text.Length <= MaxAdviceLength ? text : text[..MaxAdviceLength].TrimEnd() + "…";
    }

    private const string Instructions = $"""
        #agent: {AgentKey}
        You advise the owner of a café, restaurant or kitchen in Egypt on their menu, from its menu-engineering matrix.
        The user message is a JSON object: "days" of sales it covers, "averageMargin" (the margin, in Egyptian pounds,
        from which an item counts as paying), "popularShare" (the share of units sold from which an item counts as
        popular), the items (name, category, price, cost of one sale, margin, food cost %, units sold, share of units
        sold, and class), "languages", and "note": the owner's own instructions, often empty.
        The classes: star sells and pays; plowhorse sells but leaves little; puzzle pays but does not sell; dog does
        neither.
        {ContentLanguages.PromptRule}
        Rules:
        - When "note" has text, it comes first: respect what it rules out and look at what it asks about.
        - Give a move only for items worth changing, the most money at stake first, at most about 15. Leave stars as
          they are unless something stands out; then "keep" with what to protect.
        - plowhorse: "raise-price" by a round amount customers will hardly notice (5 or 10 pounds on a typical item),
          or "rework" to a cheaper recipe or smaller portion when food cost is high. Name the amount.
        - puzzle: "promote": move it up the menu, give it a photo, have staff suggest it, pair it with a star; or
          "lower-price" when it is clearly priced above its kind.
        - dog: "remove", unless it is a staple a menu of its kind needs (water, a plain tea, a kids' item) or the
          category is nearly empty without it; then "rework" or "keep" and say why.
        - Say why in the owner's terms: what it earns, what it sells, what it would change. Use the numbers you are
          given; never invent sales or costs. Pounds as "EGP 15" in English and "١٥ جنيه" in Arabic.
        - summary: two or three sentences on the menu as a whole: where the money comes from and the one or two moves
          that matter most.
        - notes is normally "".
        - Answer with the JSON object only.
        """;
}
