#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.StockItemAggregate;

public interface IStockItemRepository : IRepository<StockItem>
{
    StockItem Add(StockItem item);

    Task<StockItem?> GetAsync(int id);

    Task<List<StockItem>> GetManyAsync(IEnumerable<int> ids);
}
