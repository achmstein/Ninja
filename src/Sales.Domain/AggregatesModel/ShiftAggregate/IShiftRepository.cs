#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

public interface IShiftRepository : IRepository<Shift>
{
    Shift Add(Shift shift);

    Task<Shift?> GetAsync(int shiftId);

    /// <summary>The branch's one open shift, if any.</summary>
    Task<Shift?> FindOpenByBranchAsync(int branchId);
}
