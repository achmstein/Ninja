#nullable enable
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.Infrastructure.Repositories;

public class ShiftRepository : IShiftRepository
{
    private readonly SalesContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public ShiftRepository(SalesContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public Shift Add(Shift shift)
        => _context.Shifts.Add(shift).Entity;

    public async Task<Shift?> GetAsync(int shiftId)
        => await _context.Shifts.FirstOrDefaultAsync(s => s.Id == shiftId);

    public async Task<Shift?> FindOpenByBranchAsync(int branchId)
        => await _context.Shifts
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.Status == ShiftStatus.Open);
}
