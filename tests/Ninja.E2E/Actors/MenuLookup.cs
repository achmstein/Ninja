using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Actors;

/// <summary>
/// The menu as the till sees it for branch 1 (GET /api/catalog/items), so
/// scenarios can ring items up by their English name at the branch price.
/// </summary>
public sealed class MenuLookup
{
    private readonly ApiClient _api;
    private List<CatalogItem> _items = [];

    private MenuLookup(ApiClient api) => _api = api;

    public static async Task<MenuLookup> LoadAsync(ApiClient api, CancellationToken ct)
    {
        var menu = new MenuLookup(api);
        await menu.RefreshAsync(ct);
        return menu;
    }

    public async Task RefreshAsync(CancellationToken ct)
        => _items = await _api.GetAsync<List<CatalogItem>>("/api/catalog/items", ct);

    public IReadOnlyList<CatalogItem> Items => _items;

    public CatalogItem Item(string englishName)
        => _items.FirstOrDefault(i => string.Equals(i.Name.En, englishName, StringComparison.Ordinal))
           ?? throw new InvalidOperationException($"No menu item named '{englishName}' on branch 1. Known: {string.Join(", ", _items.Select(i => i.Name.En))}");

    public CatalogItem Item(int id)
        => _items.FirstOrDefault(i => i.Id == id) ?? throw new InvalidOperationException($"No menu item with id {id}");

    /// <summary>Seeded items every scenario can rely on (src/Catalog.API/Infrastructure/CatalogContextSeed.cs).</summary>
    public const string TurkishCoffee = "Turkish Coffee";   // 25.00, category 1
    public const string Tea = "Tea";                        // 15.00, category 3
    public const string Cappuccino = "Cappuccino";          // 50.00, category 1
}
