#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.RecipeAggregate;

/// <summary>
/// What one unit of a menu item takes out of the storeroom, as slots: the
/// coffee, the sugar, the cup, each with a default and the overrides the
/// customer's choices trigger; a bigger size is an override with a bigger
/// amount, nothing more. Keyed by the catalog item (global, like the item
/// itself); Catalog is never asked: the back office picks the item,
/// Inventory keeps only its id. A menu item without a recipe is simply not
/// tracked.
/// </summary>
public class Recipe : IAggregateRoot
{
    public int CatalogItemId { get; private set; }

    private readonly List<RecipeLine> _lines = new();
    public IReadOnlyCollection<RecipeLine> Lines => _lines.AsReadOnly();

    protected Recipe() { }

    public Recipe(int catalogItemId, IEnumerable<RecipeLine> lines)
    {
        if (catalogItemId <= 0)
            throw new InventoryDomainException("A recipe needs the menu item it is for.");

        CatalogItemId = catalogItemId;
        SetLines(lines);
    }

    /// <summary>Sold by the unit: the stock item is the menu item, one each, whatever the size.</summary>
    public static Recipe ForUnit(int catalogItemId, int stockItemId)
        => new(catalogItemId, [new RecipeLine(stockItemId, 1)]);

    /// <summary>
    /// Replaces the lines. A line with slot 0 becomes a slot of its own — the
    /// shape every recipe had before slots existed, and still what a plain
    /// list of ingredients means.
    /// </summary>
    public void SetLines(IEnumerable<RecipeLine> lines)
    {
        var list = lines.ToList();

        if (list.Count == 0)
            throw new InventoryDomainException("A recipe needs at least one line.");

        AssignSlots(list);

        foreach (var slot in list.GroupBy(l => l.Slot))
        {
            if (slot.Count(l => l.IsBase) > 1)
                throw new InventoryDomainException("A slot has one default: the line with no options.");

            if (slot.GroupBy(l => l.OptionKey).Any(g => g.Count() > 1))
                throw new InventoryDomainException("A slot lists each option combination once.");

            if (slot.All(l => l.IsNone))
                throw new InventoryDomainException("A slot needs something to deduct; a none override alone deducts nothing.");
        }

        // The same ingredient for the same choice in two slots would deduct twice
        var duplicate = list
            .Where(l => !l.IsNone)
            .GroupBy(l => (l.StockItemId, l.OptionKey))
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate is not null)
            throw new InventoryDomainException("A recipe lists each stock item once per option combination.");

        _lines.Clear();
        _lines.AddRange(list);
    }

    /// <summary>Base ingredients: the defaults, what a sale takes when nothing is chosen.</summary>
    public IEnumerable<RecipeLine> BaseLines => _lines.Where(l => l.IsBase);

    /// <summary>
    /// What selling <paramref name="units"/> of this item consumes: for each
    /// slot, the most specific override whose options were all chosen, else
    /// the default; a none override deducts nothing.
    /// </summary>
    public IEnumerable<(int StockItemId, decimal Quantity)> Explode(int units, IReadOnlyCollection<int>? chosenOptionIds = null)
    {
        if (units <= 0)
            yield break;

        foreach (var slot in _lines.GroupBy(l => l.Slot).OrderBy(g => g.Key))
        {
            var resolved = Resolve(slot.ToList(), chosenOptionIds);
            if (resolved is null || resolved.IsNone)
                continue;

            yield return (resolved.StockItemId, resolved.Quantity * units);
        }
    }

    /// <summary>The line a slot resolves to for these choices: the most specific applicable override, else the default, else nothing.</summary>
    public static RecipeLine? Resolve(IReadOnlyList<RecipeLine> slot, IReadOnlyCollection<int>? chosenOptionIds)
    {
        RecipeLine? best = null;
        foreach (var line in slot)
        {
            if (line.IsBase || !line.AppliesTo(chosenOptionIds))
                continue;

            // Ties keep the earlier line, so the order the recipe was saved in decides
            if (best is null || line.OptionIds.Count > best.OptionIds.Count)
                best = line;
        }

        return best ?? slot.FirstOrDefault(l => l.IsBase);
    }

    /// <summary>Slot 0 means "its own slot"; the rest are renumbered 1.. in order of first appearance.</summary>
    private static void AssignSlots(List<RecipeLine> lines)
    {
        var next = 0;
        var renumbered = new Dictionary<int, int>();
        foreach (var line in lines)
        {
            if (line.Slot == 0)
            {
                line.AssignSlot(++next);
                continue;
            }

            if (!renumbered.TryGetValue(line.Slot, out var slot))
            {
                slot = ++next;
                renumbered[line.Slot] = slot;
            }

            line.AssignSlot(slot);
        }
    }
}
