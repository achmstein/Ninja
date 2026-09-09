#nullable enable
using Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;

namespace Chillax.Sales.Infrastructure.Repositories;

public class TabPaymentRepository : ITabPaymentRepository
{
    private readonly SalesContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public TabPaymentRepository(SalesContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public TabPayment Add(TabPayment payment)
        => _context.TabPayments.Add(payment).Entity;

    public void Remove(TabPayment payment)
        => _context.Entry(payment).State = EntityState.Detached;

    public async Task<TabPayment?> GetAsync(int id)
        => await _context.TabPayments.FirstOrDefaultAsync(p => p.Id == id);

    public async Task<int> GetLastNumberAsync(int branchId)
        => await _context.TabPayments
            .Where(p => p.BranchId == branchId)
            .MaxAsync(p => (int?)p.Number) ?? 0;
}
