#nullable enable
namespace Chillax.Inventory.Infrastructure.Repositories;

public class StockItemRepository(InventoryContext context) : IStockItemRepository
{
    public IUnitOfWork UnitOfWork => context;

    public StockItem Add(StockItem item) => context.StockItems.Add(item).Entity;

    public Task<StockItem?> GetAsync(int id) => context.StockItems.FirstOrDefaultAsync(s => s.Id == id);

    public Task<List<StockItem>> GetManyAsync(IEnumerable<int> ids)
    {
        var list = ids.Distinct().ToList();
        return context.StockItems.Where(s => list.Contains(s.Id)).ToListAsync();
    }
}

public class RecipeRepository(InventoryContext context) : IRecipeRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Recipe Add(Recipe recipe) => context.Recipes.Add(recipe).Entity;

    public void Remove(Recipe recipe) => context.Recipes.Remove(recipe);

    public Task<Recipe?> GetAsync(int catalogItemId)
        => context.Recipes.FirstOrDefaultAsync(r => r.CatalogItemId == catalogItemId);

    public Task<List<Recipe>> GetManyAsync(IEnumerable<int> catalogItemIds)
    {
        var list = catalogItemIds.Distinct().ToList();
        return context.Recipes.Where(r => list.Contains(r.CatalogItemId)).ToListAsync();
    }

    public Task<List<Recipe>> GetUsingAsync(IEnumerable<int> stockItemIds)
        => GetUsingAsync(stockItemIds, optionLines: false);

    public Task<List<Recipe>> GetUsingInOptionsAsync(IEnumerable<int> stockItemIds)
        => GetUsingAsync(stockItemIds, optionLines: true);

    private async Task<List<Recipe>> GetUsingAsync(IEnumerable<int> stockItemIds, bool optionLines)
    {
        var list = stockItemIds.Distinct().ToList();

        var catalogItemIds = await context.RecipeLines
            .Where(l => (optionLines ? l.OptionIds.Count > 0 : l.OptionIds.Count == 0) && list.Contains(l.StockItemId))
            .Select(l => EF.Property<int>(l, "CatalogItemId"))
            .Distinct()
            .ToListAsync();

        return await context.Recipes.Where(r => catalogItemIds.Contains(r.CatalogItemId)).ToListAsync();
    }
}

public class PurchaseRepository(InventoryContext context) : IPurchaseRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Purchase Add(Purchase purchase) => context.Purchases.Add(purchase).Entity;

    public Task<Purchase?> GetAsync(int id) => context.Purchases.FirstOrDefaultAsync(p => p.Id == id);
}

public class TransferRepository(InventoryContext context) : ITransferRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Transfer Add(Transfer transfer) => context.Transfers.Add(transfer).Entity;

    public Task<Transfer?> GetAsync(int id) => context.Transfers.FirstOrDefaultAsync(t => t.Id == id);
}

public class StockCountRepository(InventoryContext context) : IStockCountRepository
{
    public IUnitOfWork UnitOfWork => context;

    public StockCount Add(StockCount count) => context.StockCounts.Add(count).Entity;

    public Task<StockCount?> GetAsync(int id) => context.StockCounts.FirstOrDefaultAsync(c => c.Id == id);
}
