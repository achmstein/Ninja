#nullable enable
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;
using Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;
using Chillax.Sales.Infrastructure;

namespace Chillax.Sales.API.Application.Queries;

/// <summary>
/// The cash figures a shift's tickets contributed to the drawer.
/// </summary>
public record ShiftCashTotals(decimal CashPayments, decimal ChangeGiven, decimal CashRefunds, decimal CashTabPayments);

public interface IShiftQueries
{
    /// <summary>The branch's open shift as a live X report, or null.</summary>
    Task<ShiftView?> GetCurrentShiftAsync(int branchId);

    /// <summary>One shift as an X (open) or Z (closed) report.</summary>
    Task<ShiftView?> GetShiftAsync(int shiftId);

    /// <summary>Closed shifts, newest first — the Z-report history.</summary>
    Task<IEnumerable<ShiftView>> GetClosedShiftsAsync(int branchId, int pageIndex, int pageSize, DateTime? from = null, DateTime? to = null);

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

    public async Task<IEnumerable<ShiftView>> GetClosedShiftsAsync(int branchId, int pageIndex, int pageSize, DateTime? from = null, DateTime? to = null)
    {
        // A shift belongs to the business day it opened on
        var shifts = await context.Shifts
            .AsNoTracking()
            .Where(s => s.BranchId == branchId && s.Status == ShiftStatus.Closed)
            .Where(s => from == null || s.OpenedAt >= from.Value)
            .Where(s => to == null || s.OpenedAt <= to.Value)
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

        var cashRefunds = await context.Refunds
            .AsNoTracking()
            .Where(r => r.ShiftId == shiftId && r.Tender == PaymentTender.Cash)
            .SumAsync(r => r.Amount);

        var cashTabPayments = await context.TabPayments
            .AsNoTracking()
            .Where(p => p.ShiftId == shiftId && p.Tender == PaymentTender.Cash)
            .SumAsync(p => p.Amount);

        return new ShiftCashTotals(
            tickets.SelectMany(t => t.Payments).Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount),
            tickets.Sum(t => t.ChangeGiven),
            cashRefunds,
            cashTabPayments);
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

        // Credit notes issued during the shift: cash ones left the drawer
        var refunds = await context.Refunds.AsNoTracking().Where(r => r.ShiftId == shift.Id).ToListAsync();
        var refundsTotal = refunds.Sum(r => r.Amount);
        var cashRefunds = refunds.Where(r => r.Tender == PaymentTender.Cash).Sum(r => r.Amount);
        var payIns = shift.GetPayInsTotal();
        var payOuts = shift.GetPayOutsTotal();

        // Money taken against tabs during the shift: not sales (those were
        // counted when the bill went on account), but cash ones sit in the
        // drawer and the rest reconcile against the terminal
        var tabPayments = await context.TabPayments
            .AsNoTracking()
            .Where(p => p.ShiftId == shift.Id)
            .OrderByDescending(p => p.Number)
            .ToListAsync();
        var cashTabPayments = tabPayments.Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount);

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
                m.Type.ToString(), m.Amount, m.Reason, m.RecordedBy, m.RecordedAt, m.Kind.ToString(), m.EmployeeId, m.EmployeeName,
                m.SupplierId, m.SupplierName, m.PartnerId, m.PartnerName, m.CategoryId)).ToList(),
            TicketsSettled = tickets.Count,
            SalesTotal = tickets.Sum(t => t.Total),
            RefundsTotal = refundsTotal,
            CashRefunds = cashRefunds,
            TenderTotals = tenders,
            ChangeGiven = changeGiven,
            PayInsTotal = payIns,
            PayOutsTotal = payOuts,
            TabPaymentsTotal = tabPayments.Sum(p => p.Amount),
            CashTabPayments = cashTabPayments,
            TabPaymentTenderTotals = TenderTotals(tabPayments),
            TabPayments = tabPayments.Select(ToView).ToList(),
            // Live for an open shift; for a closed one the frozen ExpectedCash
            // is the authoritative number and these two should agree
            ExpectedInDrawer = shift.OpeningFloat + cashPayments - changeGiven - cashRefunds + cashTabPayments + payIns - payOuts,
        };
    }

    private IQueryable<Ticket> ShiftTickets(int shiftId)
        => context.Tickets.AsNoTracking().Where(t => t.ShiftId == shiftId);

    public static List<TenderTotal> TenderTotals(IEnumerable<TabPayment> payments)
        => payments
            .GroupBy(p => p.Tender)
            .Select(g => new TenderTotal(g.Key.ToString(), g.Sum(p => p.Amount), g.Count()))
            .OrderBy(t => t.Tender)
            .ToList();

    public static TabPaymentView ToView(TabPayment p)
        => new(p.Id, p.Number, p.BranchId, p.CustomerId, p.CustomerName, p.Tender.ToString(), p.Amount, p.RecordedBy, p.RecordedAt, p.ShiftId);
}
