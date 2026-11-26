#nullable enable
using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Domain.AggregatesModel.TabPaymentAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// The cash figures a shift's tickets contributed to the drawer, and the part
/// payments it took and gave back.
/// </summary>
/// <param name="CashPayments">Cash handed over at settle, without what was taken earlier as part payments.</param>
/// <param name="PartPaymentsTotal">Part payments this shift took, all tenders.</param>
/// <param name="CashPartPayments">The cash among them: into this drawer.</param>
/// <param name="PartPaymentsReturned">Part payments given back during this shift, all tenders.</param>
/// <param name="CashPartPaymentsReturned">The cash among them: out of this drawer.</param>
public record ShiftCashTotals(
    decimal CashPayments,
    decimal ChangeGiven,
    decimal CashRefunds,
    decimal CashTabPayments,
    decimal PartPaymentsTotal = 0,
    decimal CashPartPayments = 0,
    decimal PartPaymentsReturned = 0,
    decimal CashPartPaymentsReturned = 0,
    List<TenderTotal>? PartPaymentTenderTotals = null);

/// <summary>A shift's part payments: what it took, and what it gave back (of its own or an earlier shift's).</summary>
public sealed record ShiftPartPayments(List<PartPayment> Taken, List<PartPayment> Returned)
{
    public decimal TakenTotal => Taken.Sum(p => p.Amount);
    public decimal CashTaken => Taken.Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount);
    public decimal ReturnedTotal => Returned.Sum(p => p.Amount);
    public decimal CashReturned => Returned.Where(p => p.Tender == PaymentTender.Cash).Sum(p => p.Amount);

    public List<TenderTotal> TenderTotals => Taken
        .GroupBy(p => p.Tender)
        .Select(g => new TenderTotal(g.Key.ToString(), g.Sum(p => p.Amount), g.Count(), g.Sum(p => p.Amount)))
        .OrderBy(t => t.Tender)
        .ToList();
}

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
        // A shift belongs to the business day it opened on; the window is
        // [from, to) like every other report's, so a shift opened on the very
        // moment one day ends is the next day's, not both
        var shifts = await context.Shifts
            .AsNoTracking()
            .Where(s => s.BranchId == branchId && s.Status == ShiftStatus.Closed)
            .Where(s => from == null || s.OpenedAt >= from.Value)
            .Where(s => to == null || s.OpenedAt < to.Value)
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

        var parts = await PartPaymentsOfAsync(shiftId);

        // Cash that was a part payment went into the drawer of the shift that
        // took it: here it is counted from the part payments, not from the
        // bills this shift settled
        return new ShiftCashTotals(
            TicketQueries.CashTenderedOf(tickets),
            tickets.Sum(t => t.ChangeGiven),
            cashRefunds,
            cashTabPayments,
            parts.TakenTotal,
            parts.CashTaken,
            parts.ReturnedTotal,
            parts.CashReturned,
            parts.TenderTotals);
    }

    /// <summary>
    /// The part payments this shift took (given back since or not), and the
    /// ones given back during it. One taken and given back in the same shift
    /// is in both, and so comes to nothing in its drawer.
    /// </summary>
    private async Task<ShiftPartPayments> PartPaymentsOfAsync(int shiftId)
    {
        var rows = await context.PartPayments
            .AsNoTracking()
            .Where(p => p.ShiftId == shiftId || p.ReturnedShiftId == shiftId)
            .ToListAsync();

        return new ShiftPartPayments(
            rows.Where(p => p.ShiftId == shiftId).ToList(),
            rows.Where(p => p.ReturnedShiftId == shiftId).ToList());
    }

    private async Task<ShiftView> BuildViewAsync(Shift shift)
    {
        // A shift settles a handful of tickets a night — loading them whole
        // keeps the money math in the aggregate, same as the floor view
        var tickets = await ShiftTickets(shift.Id).ToListAsync();

        // Cash net of the change, so the tenders add up to the sales; the
        // drawer below works from what was handed over and the change apart
        var tenders = SalesFigures.Tenders(tickets);

        var cashPayments = TicketQueries.CashTenderedOf(tickets);
        var changeGiven = tickets.Sum(t => t.ChangeGiven);

        // Credit notes issued during the shift, whatever the tender (older
        // ones carry a shift only when they were cash): cash ones left the drawer
        var refunds = await context.Refunds.AsNoTracking().Where(r => r.ShiftId == shift.Id).ToListAsync();
        var refundsTotal = refunds.Sum(r => r.Amount);
        var cashRefunds = refunds.Where(r => r.Tender == PaymentTender.Cash).Sum(r => r.Amount);
        var figures = SalesFigures.Of(tickets, refunds, await TicketQueries.RefundedSalesAsync(context, refunds));
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

        // Live for an open shift; for a closed one the frozen ExpectedCash is
        // the verdict, and anything this has above it is cash from sales rung
        // up offline during the shift that reached it after the close
        var parts = await PartPaymentsOfAsync(shift.Id);

        var expectedInDrawer = shift.OpeningFloat + cashPayments - changeGiven - cashRefunds + cashTabPayments
            + parts.CashTaken - parts.CashReturned + payIns - payOuts;
        var lateCash = shift.Status == ShiftStatus.Closed && shift.ExpectedCash is { } frozen ? expectedInDrawer - frozen : 0m;

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
            SalesTotal = figures.GrossSales,
            GrossSales = figures.GrossSales,
            NetSales = figures.NetSales,
            NetSalesExVat = figures.NetSalesExVat,
            Vat = figures.Vat,
            VatAdded = figures.VatAdded,
            RefundVat = figures.RefundVat,
            Discounts = figures.Discounts,
            BillDiscounts = figures.BillDiscounts,
            LineDiscounts = figures.LineDiscounts,
            LoyaltyAndPromo = figures.LoyaltyAndPromo,
            CashTendered = cashPayments,
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
            PartPaymentsTotal = parts.TakenTotal,
            CashPartPayments = parts.CashTaken,
            PartPaymentsReturned = parts.ReturnedTotal,
            CashPartPaymentsReturned = parts.CashReturned,
            PartPaymentTenderTotals = parts.TenderTotals,
            ExpectedInDrawer = expectedInDrawer,
            LateCash = lateCash,
            AdjustedOverShort = shift.ClosingCount is { } counted && shift.Status == ShiftStatus.Closed ? counted - expectedInDrawer : null,
        };
    }

    private IQueryable<Ticket> ShiftTickets(int shiftId)
        => context.Tickets.AsNoTracking().Where(t => t.ShiftId == shiftId);

    public static List<TenderTotal> TenderTotals(IEnumerable<TabPayment> payments)
        => payments
            .GroupBy(p => p.Tender)
            .Select(g => new TenderTotal(g.Key.ToString(), g.Sum(p => p.Amount), g.Count(), g.Sum(p => p.Amount)))
            .OrderBy(t => t.Tender)
            .ToList();

    public static TabPaymentView ToView(TabPayment p)
        => new(p.Id, p.Number, p.BranchId, p.CustomerId, p.CustomerName, p.Tender.ToString(), p.Amount, p.RecordedBy, p.RecordedAt, p.ShiftId);
}
