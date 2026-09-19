#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.PurchaseAggregate;

public interface IPurchaseRepository : IRepository<Purchase>
{
    Purchase Add(Purchase purchase);

    Task<Purchase?> GetAsync(int id);
}
