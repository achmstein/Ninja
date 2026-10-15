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

    // The holds are row locks in Postgres. Attributions share theirs, so two
    // tills settling at once never wait on each other; a close takes the row
    // for itself, so it waits for every attribution already holding it and
    // every later one waits for the close. Read Committed re-reads the row
    // once the wait is over, which is how a sale that waited on a close finds
    // the shift closed. The in-memory store the unit tests use has no locks.

    public async Task<int?> HoldOpenForAttributionAsync(int branchId)
    {
        if (!_context.Database.IsRelational())
            return (await FindOpenByBranchAsync(branchId))?.Id;

        var ids = await _context.Database
            .SqlQuery<int>($"""SELECT "Id" AS "Value" FROM sales.shifts WHERE "BranchId" = {branchId} AND "Status" = 'Open' FOR SHARE""")
            .ToListAsync();

        return ids.Count == 0 ? null : ids[0];
    }

    public async Task<Shift?> HoldForAttributionAsync(int shiftId)
    {
        if (_context.Database.IsRelational())
        {
            await _context.Database
                .SqlQuery<int>($"""SELECT "Id" AS "Value" FROM sales.shifts WHERE "Id" = {shiftId} FOR SHARE""")
                .ToListAsync();
        }

        // Read after the hold, past anything this context already tracks, so
        // a close that was waited for is seen
        return await _context.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId);
    }

    public async Task HoldForCloseAsync(int shiftId)
    {
        if (!_context.Database.IsRelational())
            return;

        await _context.Database
            .SqlQuery<int>($"""SELECT "Id" AS "Value" FROM sales.shifts WHERE "Id" = {shiftId} FOR UPDATE""")
            .ToListAsync();
    }
}
