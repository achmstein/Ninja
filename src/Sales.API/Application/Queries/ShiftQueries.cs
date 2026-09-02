#nullable enable
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;
using Chillax.Sales.Infrastructure;

namespace Chillax.Sales.API.Application.Queries;

/// <summary>
/// The cash figures a shift's tickets contributed to the drawer.
/// </summary>
public record ShiftCashTotals(decimal CashPayments, decimal ChangeGiven);

public interface IShiftQueries
{
    /// <summary>The branch's open shift as a live X report, or null.</summary>
    Task<ShiftView?> GetCurrentShiftAsync(int branchId);

    /// <summary>One shift as an X (open) or Z (closed) report.</summary>
    Task<ShiftView?> GetShiftAsync(int shiftId);

    /// <summary>Closed shifts, newest first — the Z-report history.</summary>
    Task<IEnumerable<ShiftView>> GetClosedShiftsAsync(int branchId, int pageIndex, int pageSize);

    Task<ShiftCashTotals> GetShiftCashAsync(int shiftId);
}

public class ShiftQueries(SalesContext context) : IShiftQueries
{
    public async Task<ShiftView?> GetCurrentShiftAsync(int branchId)
    {
        var shift = await context.Shifts
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.Status == ShiftStatus.Open);

        return shift is null ? null : await BuildViewAsync(shift);
    }

    public async Task<ShiftView?> GetShiftAsync(int shiftId)
    {
        var shift = await context.Shifts
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == shiftId);

        return shift is null ? null : await BuildViewAsync(shift);
    }

    public async Task<IEnumerable<ShiftView>> GetClosedShiftsAsync(int branchId, int pageIndex, int pageSize)
    {
        var shifts = await context.Shifts
            .AsNoTracking()
            .Where(s => s.BranchId == branchId && s.Status == ShiftStatus.Closed)
            .OrderByDescending(s => s.OpenedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var views = new List<ShiftView>(shifts.Count);
        foreach (var shift in shifts)
        {
            views.Add(await BuildViewAsync(shift));
        }

        return views;
    }

    public async Task<ShiftCashTotals> GetShiftCashAsync(int shiftId)
    {
        var tickets = await ShiftTickets(shiftId).ToListAsync();

        return new ShiftCashTotals(
            tickets.SelectMany(t => t.Payments).Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount),
            tickets.Sum(t => t.ChangeGiven));
    }

    private async Task<ShiftView> BuildViewAsync(Shift shift)
    {
        // A shift settles a handful of tickets a night — loading them whole
        // keeps the money math in the aggregate, same as the floor view
        var tickets = await ShiftTickets(shift.Id).ToListAsync();

        var tenders = tickets
            .SelectMany(t => t.Payments)
            .GroupBy(p => p.Tender)
            .Select(g => new TenderTotal(g.Key.ToString(), g.Sum(p => p.Amount), g.Count()))
            .OrderBy(t => t.Tender)
            .ToList();

        var cashPayments = tickets.SelectMany(t => t.Payments).Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount);
        var changeGiven = tickets.Sum(t => t.ChangeGiven);
        var payIns = shift.GetPayInsTotal();
        var payOuts = shift.GetPayOutsTotal();

        return new ShiftView
        {
            Id = shift.Id,
            BranchId = shift.BranchId,
            Status = shift.Status.ToString(),
            OpenedAt = shift.OpenedAt,
            OpenedBy = shift.OpenedBy,
            OpeningFloat = shift.OpeningFloat,
            ClosedAt = shift.ClosedAt,
            ClosedBy = shift.ClosedBy,
            ClosingCount = shift.ClosingCount,
            ExpectedCash = shift.ExpectedCash,
            OverShort = shift.OverShort,
            Movements = shift.Movements.Select(m => new CashMovementView(
                m.Type.ToString(), m.Amount, m.Reason, m.RecordedBy, m.RecordedAt)).ToList(),
            TicketsSettled = tickets.Count,
            SalesTotal = tickets.Sum(t => t.GetTotal()),
            TenderTotals = tenders,
            ChangeGiven = changeGiven,
            PayInsTotal = payIns,
            PayOutsTotal = payOuts,
            // Live for an open shift; for a closed one the frozen ExpectedCash
            // is the authoritative number and these two should agree
            ExpectedInDrawer = shift.OpeningFloat + cashPayments - changeGiven + payIns - payOuts,
        };
    }

    private IQueryable<Ticket> ShiftTickets(int shiftId)
        => context.Tickets.AsNoTracking().Where(t => t.ShiftId == shiftId);
}
