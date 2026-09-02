#nullable enable
using Chillax.Sales.Infrastructure;

namespace Chillax.Sales.API.Application.Queries;

public interface ITicketQueries
{
    Task<IEnumerable<TicketSummary>> GetOpenTicketsAsync(int branchId);

    /// <summary>
    /// Settled bills for the branch, newest receipt first — the way back to
    /// a bill after it left the floor. A receipt number narrows to that one.
    /// </summary>
    Task<IEnumerable<SettledTicketSummary>> GetSettledTicketsAsync(int branchId, int pageIndex, int pageSize, int? receiptNumber);

    Task<TicketDetail?> GetTicketAsync(int ticketId);

    /// <summary>
    /// The ticket a confirmed order's lines landed on — how the POS routes the
    /// cashier from a just-created counter sale to its settle screen. Null
    /// while the confirmation event is still in flight. Prefers the open
    /// ticket (lines may have been moved), falling back to the newest.
    /// </summary>
    Task<int?> FindTicketIdByOrderAsync(int orderId);

    /// <summary>
    /// Settled sales in [from, to) — tender split, discounts, per-type counts.
    /// The caller picks the window (the branch business day, a shift, a week).
    /// </summary>
    Task<RangeReport> GetRangeReportAsync(int branchId, DateTime from, DateTime to);

    /// <summary>The branch's pricing rules, defaults when it never set any.</summary>
    Task<PricingView> GetPricingAsync(int branchId);
}

public class TicketQueries(SalesContext context) : ITicketQueries
{
    public async Task<IEnumerable<TicketSummary>> GetOpenTicketsAsync(int branchId)
    {
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId && t.Status == TicketStatus.Open)
            .OrderBy(t => t.OpenedAt)
            .ToListAsync();

        var rules = await RulesForAsync(branchId);

        // Lines auto-include; totals come from the aggregate so the floor
        // and the settle dialog can never disagree on the math
        return tickets.Select(t => new TicketSummary
        {
            Id = t.Id,
            Type = t.Type.ToString(),
            Status = t.Status.ToString(),
            LocationName = t.LocationName,
            SessionId = t.SessionId,
            RoomId = t.RoomId,
            TableId = t.TableId,
            Label = t.Label,
            OpenedAt = t.OpenedAt,
            LastActivityAt = t.LastActivityAt,
            LineCount = t.Lines.Count,
            Total = t.GetBill(rules).Total,
        });
    }

    public async Task<IEnumerable<SettledTicketSummary>> GetSettledTicketsAsync(int branchId, int pageIndex, int pageSize, int? receiptNumber)
    {
        // Receipts are the index: one per settled ticket, numbered in order
        var receipts = context.Receipts.AsNoTracking().Where(r => r.BranchId == branchId);

        if (receiptNumber is int number)
            receipts = receipts.Where(r => r.Number == number);

        var page = await receipts
            .OrderByDescending(r => r.Number)
            .Skip(Math.Max(0, pageIndex) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var ticketIds = page.Select(r => r.TicketId).ToList();

        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => ticketIds.Contains(t.Id))
            .ToListAsync();

        var refunded = await context.Refunds
            .AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .GroupBy(r => r.TicketId)
            .Select(g => new { TicketId = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToDictionaryAsync(x => x.TicketId, x => x.Amount);

        return page
            .Select(r => (Receipt: r, Ticket: tickets.FirstOrDefault(t => t.Id == r.TicketId)))
            .Where(x => x.Ticket is not null)
            .Select(x => new SettledTicketSummary(
                x.Ticket!.Id,
                x.Receipt.Number,
                x.Ticket.Type.ToString(),
                x.Ticket.LocationName,
                x.Ticket.Label,
                x.Ticket.SettledAt ?? x.Receipt.IssuedAt,
                x.Ticket.Total,
                refunded.GetValueOrDefault(x.Ticket.Id)))
            .ToList();
    }

    public async Task<int?> FindTicketIdByOrderAsync(int orderId)
    {
        var candidates = await context.Tickets
            .AsNoTracking()
            .Where(t => t.Lines.Any(l => l.OrderId == orderId))
            .Select(t => new { t.Id, t.Status })
            .ToListAsync();

        if (candidates.Count == 0)
            return null;

        return (candidates.FirstOrDefault(c => c.Status == TicketStatus.Open) ?? candidates.MaxBy(c => c.Id))!.Id;
    }

    public async Task<RangeReport> GetRangeReportAsync(int branchId, DateTime from, DateTime to)
    {
        // A day is at most a few hundred tickets — load them whole and let
        // the aggregate own the money math, like everywhere else in Sales
        var tickets = await context.Tickets
            .AsNoTracking()
            .Where(t => t.BranchId == branchId
                        && t.Status == TicketStatus.Settled
                        && t.SettledAt >= from && t.SettledAt < to)
            .ToListAsync();

        var refunds = await context.Refunds
            .AsNoTracking()
            .Where(r => r.BranchId == branchId && r.RefundedAt >= from && r.RefundedAt < to)
            .ToListAsync();

        return new RangeReport
        {
            From = from,
            To = to,
            TicketsSettled = tickets.Count,
            Net = tickets.Sum(t => t.Total),
            Subtotal = tickets.Sum(t => t.Subtotal),
            ServiceCharge = tickets.Sum(t => t.ServiceCharge),
            Vat = tickets.Sum(t => t.Vat),
            Refunds = refunds.Sum(r => r.Amount),
            RefundCount = refunds.Count,
            // Line discounts plus loyalty (negative) lines, reported positive
            Discounts = tickets
                .SelectMany(t => t.Lines)
                .Sum(l => l.Discount + (l.Total < 0 ? -l.Total : 0)),
            ChangeGiven = tickets.Sum(t => t.ChangeGiven),
            TenderTotals = tickets
                .SelectMany(t => t.Payments)
                .GroupBy(p => p.Tender)
                .Select(g => new TenderTotal(g.Key.ToString(), g.Sum(p => p.Amount), g.Count()))
                .OrderBy(t => t.Tender)
                .ToList(),
            ByType = tickets
                .GroupBy(t => t.Type)
                .Select(g => new TypeTotal(g.Key.ToString(), g.Count(), g.Sum(t => t.Total)))
                .OrderBy(t => t.Type)
                .ToList(),
        };
    }

    public async Task<TicketDetail?> GetTicketAsync(int ticketId)
    {
        var ticket = await context.Tickets
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket is null)
            return null;

        var receipt = await context.Receipts
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.TicketId == ticketId);

        var bill = ticket.GetBill(await RulesForAsync(ticket.BranchId));

        var refunds = await context.Refunds
            .AsNoTracking()
            .Where(r => r.TicketId == ticketId)
            .OrderBy(r => r.Number)
            .ToListAsync();

        return new TicketDetail
        {
            Id = ticket.Id,
            Type = ticket.Type.ToString(),
            Status = ticket.Status.ToString(),
            BranchId = ticket.BranchId,
            LocationName = ticket.LocationName,
            SessionId = ticket.SessionId,
            RoomId = ticket.RoomId,
            TableId = ticket.TableId,
            Label = ticket.Label,
            GuestPhone = ticket.GuestPhone,
            OpenedAt = ticket.OpenedAt,
            LastActivityAt = ticket.LastActivityAt,
            SettledAt = ticket.SettledAt,
            SettledBy = ticket.SettledBy,
            ShiftId = ticket.ShiftId,
            ChangeGiven = ticket.ChangeGiven,
            VoidedAt = ticket.VoidedAt,
            VoidedBy = ticket.VoidedBy,
            VoidReason = ticket.VoidReason,
            Lines = ticket.Lines.Select(l => new TicketLineView
            {
                Id = l.Id,
                Source = l.Source.ToString(),
                OrderId = l.OrderId,
                Description = l.Description,
                Details = l.Details,
                Qty = l.Qty,
                UnitPrice = l.UnitPrice,
                Discount = l.Discount,
                Total = l.Total,
                AddedBy = l.AddedBy,
                CustomerName = l.CustomerName,
                CustomerId = l.CustomerId,
                GuestId = l.GuestId,
            }).ToList(),
            Payments = ticket.Payments.Select(p => new PaymentView
            {
                Tender = p.Tender.ToString(),
                Amount = p.Amount,
                CustomerName = p.CustomerName,
                CustomerId = p.CustomerId,
                RecordedBy = p.RecordedBy,
                RecordedAt = p.RecordedAt,
            }).ToList(),
            Total = bill.Total,
            Subtotal = bill.Subtotal,
            ServiceCharge = bill.ServiceCharge,
            Vat = bill.Vat,
            VatIncluded = bill.VatIncluded,
            VatRate = bill.VatRate,
            ServiceChargeRate = bill.ServiceChargeRate,
            Refunds = refunds.Select(ToView).ToList(),
            RefundedTotal = refunds.Sum(r => r.Amount),
            ReceiptNumber = receipt?.Number,
        };
    }

    public async Task<PricingView> GetPricingAsync(int branchId)
    {
        var rules = await RulesForAsync(branchId);
        return new PricingView(branchId, rules.VatRate, rules.PricesIncludeVat, rules.ServiceChargeRate);
    }

    private async Task<PricingRules> RulesForAsync(int branchId)
    {
        var pricing = await context.BranchPricings.AsNoTracking().FirstOrDefaultAsync(p => p.BranchId == branchId);
        return pricing?.Rules ?? PricingRules.None;
    }

    private static RefundView ToView(Refund refund) => new(
        refund.Id,
        refund.Number,
        refund.Amount,
        refund.Reason,
        refund.Tender.ToString(),
        refund.CustomerName,
        refund.RefundedBy,
        refund.RefundedAt,
        refund.Lines.Select(l => new RefundLineView(l.TicketLineId, l.Description, l.Qty, l.Amount)).ToList());
}
