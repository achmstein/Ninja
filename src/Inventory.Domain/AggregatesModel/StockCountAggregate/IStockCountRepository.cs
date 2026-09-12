#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.StockCountAggregate;

public interface IStockCountRepository : IRepository<StockCount>
{
    StockCount Add(StockCount count);

    Task<StockCount?> GetAsync(int id);
}
