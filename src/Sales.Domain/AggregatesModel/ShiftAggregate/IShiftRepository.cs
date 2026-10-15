#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

public interface IShiftRepository : IRepository<Shift>
{
    Shift Add(Shift shift);

    Task<Shift?> GetAsync(int shiftId);

    /// <summary>The branch's one open shift, if any.</summary>
    Task<Shift?> FindOpenByBranchAsync(int branchId);

    /// <summary>
    /// The branch's open shift, for a sale, refund or tab payment to be
    /// attributed to, held until the transaction ends so a close cannot sum
    /// the shift between this read and the commit. A close already under way
    /// is waited for, and then there is no open shift: null.
    /// </summary>
    Task<int?> HoldOpenForAttributionAsync(int branchId);

    /// <summary>
    /// One shift as it stands now, held the same way: what an offline sale
    /// replayed into the shift it was rung up in checks itself against.
    /// Read-only; null when there is no such shift.
    /// </summary>
    Task<Shift?> HoldForAttributionAsync(int shiftId);

    /// <summary>
    /// Held by a close before it sums the shift, for the rest of its
    /// transaction: an attribution that got there first is waited for and so
    /// counted, one that comes after finds the shift closed.
    /// </summary>
    Task HoldForCloseAsync(int shiftId);
}
