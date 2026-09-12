#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.StockItemAggregate;

public interface IStockItemRepository : IRepository<StockItem>
{
    StockItem Add(StockItem item);

    Task<StockItem?> GetAsync(int id);

    Task<List<StockItem>> GetManyAsync(IEnumerable<int> ids);
}
