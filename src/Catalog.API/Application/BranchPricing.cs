#nullable enable
namespace Ninja.Catalog.API.Application;

/// <summary>
/// What one line costs at a branch, or why it cannot be sold there. The one
/// answer both the order's check (when Ordering asks) and the till's price
/// check (before it sends an order to another branch) give, so the till is
/// never told a price the order is then turned down for.
/// </summary>
/// <param name="Price">The item's price at the branch at that moment with each chosen option's adjustment: the line's unit price.</param>
/// <param name="BasePrice">The item's price alone, before its options.</param>
/// <param name="Reason">Why the line cannot be sold (an <see cref="OrderValidationReasons"/>); null when it can.</param>
/// <param name="Available">The item is on the menu, and on at the branch.</param>
/// <param name="OutOfStock">The branch ran out of it (marked, or Inventory said so).</param>
/// <param name="SoldOutOptionIds">The chosen options the branch ran out of, or that are not the item's at all.</param>
public sealed record LinePrice(
    decimal Price,
    decimal BasePrice,
    string? Reason,
    bool Available,
    bool OutOfStock,
    IReadOnlyList<int> SoldOutOptionIds)
{
    public bool CanBeSold => Reason is null;
}

/// <summary>
/// The menu as one branch sells it: the items, the branch's own prices and
/// switches for them, and the options it ran out of. A branch override can
/// only restrict an item (the global switch always wins), and an Inventory
/// stock-out restricts like a manual sold-out.
/// </summary>
public sealed class BranchMenu
{
    /// <summary>Half a piastre: what rounding may leave between the app's sum and the menu's.</summary>
    public const decimal Tolerance = 0.005m;

    private readonly IReadOnlyDictionary<int, CatalogItem> _items;
    private readonly IReadOnlyDictionary<int, BranchItemOverride> _overrides;
    private readonly IReadOnlySet<int> _optionStockOuts;

    public BranchMenu(
        IReadOnlyDictionary<int, CatalogItem> items,
        IReadOnlyDictionary<int, BranchItemOverride> overrides,
        IReadOnlySet<int> optionStockOuts)
    {
        _items = items;
        _overrides = overrides;
        _optionStockOuts = optionStockOuts;
    }

    /// <summary>The branch's menu for these items: three small queries.</summary>
    public static async Task<BranchMenu> LoadAsync(CatalogContext context, int branchId, IEnumerable<int> productIds)
    {
        var ids = productIds.Distinct().ToList();
        var items = await context.CatalogItems
            .Include(i => i.Customizations)
                .ThenInclude(c => c.Options)
            .AsSplitQuery()
            .Where(i => ids.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id);
        var overrides = await context.BranchItemOverrides
            .Where(o => o.BranchId == branchId && ids.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);
        var stockOuts = await CatalogApi.GetBranchOptionStockOuts(context, branchId);
        return new BranchMenu(items, overrides, stockOuts);
    }

    /// <summary>The item, when the menu has it.</summary>
    public CatalogItem? Item(int productId) => _items.GetValueOrDefault(productId);

    /// <summary>
    /// What a line of this item with these options costs at a local moment (the
    /// offer as it stood then), or why it cannot be sold. The first reason found
    /// is the line's: the item, then each option in turn.
    /// </summary>
    public LinePrice Price(int productId, IEnumerable<int>? optionIds, DateTime local)
    {
        var chosen = (optionIds ?? []).Distinct().ToList();
        if (!_items.TryGetValue(productId, out var item))
            return new LinePrice(0, 0, OrderValidationReasons.UnknownItem, false, false, chosen);

        _overrides.TryGetValue(item.Id, out var branch);
        var onHere = item.IsAvailable && (branch is null || branch.IsAvailable);
        var outOfStock = branch is { IsOutOfStock: true };
        string? reason = onHere && !outOfStock ? null : OrderValidationReasons.Unavailable;

        var options = item.Customizations.SelectMany(c => c.Options).ToDictionary(o => o.Id);
        var adjustments = 0m;
        var soldOut = new List<int>();
        // Ordering keeps each chosen option once, as the line is priced
        foreach (var optionId in chosen)
        {
            if (!options.TryGetValue(optionId, out var option))
            {
                reason ??= OrderValidationReasons.UnknownOption;
                soldOut.Add(optionId);
                continue;
            }
            if (_optionStockOuts.Contains(optionId))
            {
                reason ??= OrderValidationReasons.OptionUnavailable;
                soldOut.Add(optionId);
            }
            adjustments += option.PriceAdjustment;
        }

        var basePrice = item.PriceAt(branch, local).Effective;
        return new LinePrice(basePrice + adjustments, basePrice, reason, onHere, outOfStock, soldOut);
    }

    /// <summary>The menu asks more than the line came at, past rounding.</summary>
    public static bool CostsMore(decimal price, decimal claimed) => price > claimed + Tolerance;

    /// <summary>The menu's price is not the one the line came at, past rounding either way.</summary>
    public static bool Differs(decimal price, decimal claimed) => Math.Abs(price - claimed) > Tolerance;
}
