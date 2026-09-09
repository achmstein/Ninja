#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;

public interface ITabPaymentRepository : IRepository<TabPayment>
{
    TabPayment Add(TabPayment payment);

    /// <summary>Forget an unsaved slip — the loser of a numbering race, before its retry.</summary>
    void Remove(TabPayment payment);

    Task<TabPayment?> GetAsync(int id);

    /// <summary>The branch's highest slip number so far (0 when none).</summary>
    Task<int> GetLastNumberAsync(int branchId);
}
