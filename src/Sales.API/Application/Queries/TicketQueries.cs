#nullable enable
using Chillax.Sales.Infrastructure;

namespace Chillax.Sales.API.Application.Queries;

public interface ITicketQueries
{
    Task<IEnumerable<TicketSummary>> GetOpenTicketsAsync(int branchId);

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
            CustomerName = t.CustomerName,
            OpenedAt = t.OpenedAt,
            LastActivityAt = t.LastActivityAt,
            LineCount = t.Lines.Count,
            Total = t.GetTotal(),
        });
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

        return new RangeReport
        {
            From = from,
            To = to,
            TicketsSettled = tickets.Count,
            Net = tickets.Sum(t => t.GetTotal()),
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
                .Select(g => new TypeTotal(g.Key.ToString(), g.Count(), g.Sum(t => t.GetTotal())))
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
            CustomerId = ticket.CustomerId,
            CustomerName = ticket.CustomerName,
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
            }).ToList(),
            Payments = ticket.Payments.Select(p => new PaymentView
            {
                Tender = p.Tender.ToString(),
                Amount = p.Amount,
                RecordedBy = p.RecordedBy,
                RecordedAt = p.RecordedAt,
            }).ToList(),
            Total = ticket.GetTotal(),
            ReceiptNumber = receipt?.Number,
        };
    }
}
