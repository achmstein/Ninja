#nullable enable
using Ninja.Finance.Infrastructure;

namespace Ninja.Finance.API.Application.Services;

/// <summary>
/// The business day a moment belongs to at a branch, by the branch's own day
/// start (kept from Tenant.API's branch settings event). A branch Finance has
/// not heard of yet keeps the old early-morning cutoff; every shift opened
/// re-sends the branch's settings, so the start arrives with the next one.
/// </summary>
public interface IBranchDays
{
    Task<TimeOnly> StartAsync(int branchId);

    Task<DateOnly> OfAsync(int branchId, DateTime utc);
}

public class BranchDays(FinanceContext context) : IBranchDays
{
    // Read once per unit of work: a handler dates several things at one branch
    private readonly Dictionary<int, TimeOnly> _starts = new();

    public async Task<TimeOnly> StartAsync(int branchId)
    {
        if (_starts.TryGetValue(branchId, out var known))
            return known;

        var row = await context.BranchDayStarts.AsNoTracking().FirstOrDefaultAsync(d => d.BranchId == branchId);
        var start = row?.DayStart ?? BusinessDay.DefaultStart;
        _starts[branchId] = start;
        return start;
    }

    public async Task<DateOnly> OfAsync(int branchId, DateTime utc)
        => BusinessDay.Of(utc, await StartAsync(branchId));
}
