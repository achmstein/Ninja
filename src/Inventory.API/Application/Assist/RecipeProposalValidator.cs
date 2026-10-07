#nullable enable
using Ninja.AI.Json;
using Ninja.AI.Text;
using Ninja.Inventory.API.Application.Queries;

namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// Turns what the model proposed into something the review sheet can
/// trust: ingredients are matched to the shelf by folded name and never
/// duplicated, every line points at a real shelf item or a proposed one,
/// options belong to the item they are on, quantities are sane, and each
/// requested item gets exactly one entry. A new ingredient of a
/// one-language business is named in that language only. Pure.
/// </summary>
public static class RecipeProposalValidator
{
    public static readonly IReadOnlySet<string> Units = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "pcs", "g", "ml" };

    public const int MaxNewItems = 80;
    public const int MaxLinesPerRecipe = 12;

    /// <summary>More than this per sale is almost certainly a per-pack figure.</summary>
    private const decimal LargeQuantity = 2000m;
    private const decimal LargePieces = 20m;

    public static RecipesProposal Validate(RecipesExtraction extraction, IReadOnlyList<MenuItemToTrack> requested, IReadOnlyList<StockItemView> shelf, IReadOnlyList<string> extraWarnings,
        string languages = ContentLanguages.Both)
    {
        languages = ContentLanguages.Normalize(languages);
        var warnings = new List<string>(extraWarnings);
        var shelfById = shelf.ToDictionary(s => s.Id);
        var shelfByName = new Dictionary<string, StockItemView>(StringComparer.Ordinal);
        foreach (var item in shelf)
        {
            if (item.Name.En is { } en)
                shelfByName.TryAdd(TextFolding.Fold(en), item);
            if (item.Name.Ar is { } ar)
                shelfByName.TryAdd(TextFolding.Fold(ar), item);
        }

        // Ingredients: one per key; a name already on the shelf resolves to that shelf item
        var newItems = new List<ProposedIngredient>();
        var byKey = new Dictionary<string, ProposedIngredient>(StringComparer.OrdinalIgnoreCase);
        var matched = new Dictionary<string, StockItemView>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in extraction.NewItems ?? [])
        {
            var key = AIJson.Clean(raw.Key, 60);
            var nameEn = AIJson.Clean(raw.NameEn, 120);
            var nameAr = AIJson.Clean(raw.NameAr, 120);
            if (key.Length == 0 && nameEn.Length == 0 && nameAr.Length == 0)
                continue;
            if (key.Length == 0)
                key = TextFolding.Fold(nameEn.Length > 0 ? nameEn : nameAr).Replace(' ', '-');
            // A business that writes one language gets its ingredient in that one
            if (nameEn.Length == 0 && nameAr.Length == 0)
            {
                if (TextFolding.HasArabic(key)) nameAr = key;
                else nameEn = key;
            }
            var label = nameEn.Length > 0 ? nameEn : nameAr;
            if (byKey.ContainsKey(key))
            {
                warnings.Add($"Ingredient \"{key}\" was proposed twice; the first is kept.");
                continue;
            }
            if (newItems.Count >= MaxNewItems)
            {
                warnings.Add($"Only the first {MaxNewItems} new ingredients are kept.");
                break;
            }

            var unit = AIJson.Clean(raw.Unit, 10).ToLowerInvariant();
            if (!Units.Contains(unit))
            {
                if (unit.Length > 0)
                    warnings.Add($"Ingredient \"{label}\": unit \"{unit}\" is not one of pcs, g, ml; set to pcs.");
                unit = "pcs";
            }

            StockItemView? existing = null;
            if (nameEn.Length > 0 && shelfByName.TryGetValue(TextFolding.Fold(nameEn), out var byEn)) existing = byEn;
            else if (nameAr.Length > 0 && shelfByName.TryGetValue(TextFolding.Fold(nameAr), out var byAr)) existing = byAr;

            decimal? packSize = raw.PackSize > 0 ? Math.Round(raw.PackSize, 3, MidpointRounding.AwayFromZero) : null;
            var packName = AIJson.Clean(raw.PackName, 40);
            // Matched to the shelf by either name above; proposed in the business's language
            var (keptEn, keptAr) = ContentLanguages.Keep(nameEn, nameAr, languages);
            var ingredient = new ProposedIngredient(
                key,
                new LocalizedText(keptEn, keptAr),
                unit,
                packSize,
                packName.Length == 0 ? null : LocalizedText.InScriptOf(packName),
                raw.AutoSoldOut);
            byKey[key] = ingredient;
            if (existing is not null)
                matched[key] = existing;
            else
                newItems.Add(ingredient);
        }

        // Recipes: one per requested item, in the request's order
        var requestedById = requested.ToDictionary(r => r.CatalogItemId);
        var answered = new Dictionary<int, ExtractedRecipe>();
        foreach (var raw in extraction.Recipes ?? [])
        {
            if (!requestedById.ContainsKey(raw.CatalogItemId))
            {
                warnings.Add($"The assistant answered for a menu item that was not asked about (id {raw.CatalogItemId}); ignored.");
                continue;
            }
            if (!answered.TryAdd(raw.CatalogItemId, raw))
                warnings.Add($"\"{requestedById[raw.CatalogItemId].Name.Primary}\" was answered twice; the first is kept.");
        }

        var recipes = new List<ProposedRecipe>(requested.Count);
        foreach (var item in requested)
        {
            var itemWarnings = new List<string>();
            if (!answered.TryGetValue(item.CatalogItemId, out var raw))
            {
                itemWarnings.Add("The assistant proposed nothing for this item; set it up by hand.");
                recipes.Add(new ProposedRecipe(item.CatalogItemId, RecipeKinds.Recipe, [], itemWarnings));
                continue;
            }

            var kind = string.Equals(AIJson.Clean(raw.Kind, 10), RecipeKinds.Unit, StringComparison.OrdinalIgnoreCase) ? RecipeKinds.Unit : RecipeKinds.Recipe;
            var optionIds = (item.Options ?? []).Select(o => o.Id).ToHashSet();
            var lines = new List<ProposedRecipeLine>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var defaultSlots = new HashSet<int>();

            if (kind == RecipeKinds.Recipe)
            {
                foreach (var line in raw.Lines ?? [])
                {
                    if (lines.Count >= MaxLinesPerRecipe)
                    {
                        itemWarnings.Add($"Only the first {MaxLinesPerRecipe} lines are kept.");
                        break;
                    }

                    int? stockItemId = null;
                    string? newKey = null;
                    string unit;
                    string label;
                    var key = AIJson.Clean(line.NewItemKey, 60);
                    if (line.StockItemId > 0 && shelfById.TryGetValue(line.StockItemId, out var onShelf))
                    {
                        stockItemId = onShelf.Id;
                        unit = onShelf.Unit;
                        label = onShelf.Name.Primary;
                    }
                    else if (key.Length > 0 && byKey.TryGetValue(key, out var proposed))
                    {
                        if (matched.TryGetValue(key, out var onShelfByName))
                        {
                            stockItemId = onShelfByName.Id;
                            unit = onShelfByName.Unit;
                            label = onShelfByName.Name.Primary;
                        }
                        else
                        {
                            newKey = proposed.Key;
                            unit = proposed.Unit;
                            label = proposed.Name.Primary;
                        }
                    }
                    else
                    {
                        itemWarnings.Add(line.StockItemId > 0
                            ? $"A line points at a stock item that does not exist (id {line.StockItemId}); dropped."
                            : $"A line points at an ingredient that was not proposed (\"{key}\"); dropped.");
                        continue;
                    }

                    var quantity = line.None ? 0 : Math.Round(line.Quantity, 3, MidpointRounding.AwayFromZero);
                    if (line.None)
                    {
                        // Nothing of the slot for its options: an override, never the slot's default
                        if ((line.OptionIds ?? []).All(id => id <= 0))
                        {
                            itemWarnings.Add($"\"{label}\": \"none\" with no option; dropped.");
                            continue;
                        }
                    }
                    else if (quantity <= 0)
                    {
                        itemWarnings.Add($"\"{label}\": no quantity; dropped.");
                        continue;
                    }
                    if ((unit == "pcs" && quantity > LargePieces) || (unit != "pcs" && quantity > LargeQuantity))
                        itemWarnings.Add($"\"{label}\": {quantity:0.###} {unit} per sale looks like a pack, not a serving; check it.");

                    var options = (line.OptionIds ?? []).Where(id => id > 0).Distinct().OrderBy(id => id).ToList();
                    var unknown = options.Where(id => !optionIds.Contains(id)).ToList();
                    if (unknown.Count > 0)
                    {
                        // Kept as a default it would count next to the real default ("oat milk" as a second milk)
                        itemWarnings.Add($"\"{label}\": tied to an option this item does not have; dropped.");
                        continue;
                    }

                    // One default per slot: a second would be counted on every sale on top of the first
                    if (options.Count == 0 && line.Slot > 0 && !defaultSlots.Add(line.Slot))
                    {
                        itemWarnings.Add($"\"{label}\": a second default for the same thing; dropped.");
                        continue;
                    }

                    var dedupeKey = $"{stockItemId?.ToString() ?? newKey}|{string.Join(",", options)}";
                    if (!seen.Add(dedupeKey))
                    {
                        itemWarnings.Add($"\"{label}\" is listed twice for the same options; the first is kept.");
                        continue;
                    }

                    lines.Add(new ProposedRecipeLine(stockItemId, newKey, quantity, options, Math.Max(0, line.Slot), line.None));
                }

                // A slot of "none" lines only would take nothing on any sale; the domain refuses it
                var hollow = lines.GroupBy(l => l.Slot).Where(g => g.All(l => l.None)).Select(g => g.Key).ToHashSet();
                if (hollow.Count > 0)
                {
                    lines.RemoveAll(l => hollow.Contains(l.Slot));
                    itemWarnings.Add("A \"none\" choice with nothing to take it from was dropped.");
                }

                if (lines.Count == 0)
                    itemWarnings.Add("No usable ingredient lines were proposed; set it up by hand or sell it as a unit.");
            }

            recipes.Add(new ProposedRecipe(item.CatalogItemId, kind, lines, itemWarnings));
        }

        // An ingredient no recipe uses is noise
        var used = recipes.SelectMany(r => r.Lines).Where(l => l.NewItemKey is not null).Select(l => l.NewItemKey!).ToHashSet(StringComparer.OrdinalIgnoreCase);
        newItems = newItems.Where(i => used.Contains(i.Key)).ToList();

        return new RecipesProposal(newItems, recipes, warnings, NullIfEmpty(AIJson.Clean(extraction.Notes, 300)));
    }

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;
}
