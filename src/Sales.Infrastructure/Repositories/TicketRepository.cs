#nullable enable
namespace Chillax.Sales.Infrastructure.Repositories;

public class TicketRepository : ITicketRepository
{
    private readonly SalesContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public TicketRepository(SalesContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public Ticket Add(Ticket ticket)
        => _context.Tickets.Add(ticket).Entity;

    public void Remove(Ticket ticket)
        => _context.Tickets.Remove(ticket);

    public async Task<Ticket?> GetAsync(int ticketId)
        => await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);

    public async Task<Ticket?> FindOpenBySessionAsync(int sessionId)
        => await _context.Tickets
            .FirstOrDefaultAsync(t => t.SessionId == sessionId && t.Status == TicketStatus.Open);

    public async Task<Ticket?> FindOpenByTableAsync(int tableId, int branchId)
        => await _context.Tickets
            .FirstOrDefaultAsync(t => t.TableId == tableId && t.BranchId == branchId && t.Status == TicketStatus.Open);

    public async Task<Ticket?> FindOpenCounterForCustomerAsync(int branchId, string? customerId, string? guestId)
    {
        if (customerId is null && guestId is null) return null;

        // The most recently touched one, should two ever exist (a cashier
        // could have opened a walk-in tab for the same person meanwhile)
        return await _context.Tickets
            .Where(t => t.BranchId == branchId && t.Type == TicketType.Counter && t.Status == TicketStatus.Open)
            .Where(t => t.Lines.Any(l =>
                (customerId != null && l.CustomerId == customerId) ||
                (guestId != null && l.GuestId == guestId)))
            .OrderByDescending(t => t.LastActivityAt)
            .FirstOrDefaultAsync();
    }

    public async Task<Ticket?> FindOpenRoomAsync(int branchId, int? roomId, LocalizedText? roomName)
    {
        var open = await _context.Tickets
            .Where(t => t.BranchId == branchId && t.Type == TicketType.Room && t.Status == TicketStatus.Open)
            .ToListAsync();

        // A room has at most one open ticket and room names are unique within a
        // branch, so either key is unambiguous. LocationName is jsonb (awkward
        // to compare in SQL) and there are only a handful of open room tickets,
        // so the name match is done in memory.
        if (roomId is int id)
        {
            var byId = open.FirstOrDefault(t => t.PlaceId == id || t.RoomId == id);
            if (byId is not null) return byId;
        }

        if (roomName is { } name && !string.IsNullOrWhiteSpace(name.En))
        {
            return open.FirstOrDefault(t =>
                t.LocationName is { } loc &&
                (string.Equals(loc.En, name.En, StringComparison.OrdinalIgnoreCase) ||
                 (loc.Ar is not null && name.Ar is not null && string.Equals(loc.Ar, name.Ar, StringComparison.Ordinal))));
        }

        return null;
    }

    public async Task<bool> HasOrderAsync(int orderId)
        => await _context.Tickets.AnyAsync(t => t.Lines.Any(l => l.OrderId == orderId));

    public async Task<IReadOnlyCollection<Ticket>> FindByOrderAsync(int orderId)
        => await _context.Tickets
            .Where(t => t.Lines.Any(l => l.OrderId == orderId))
            .ToListAsync();

    public Receipt AddReceipt(Receipt receipt)
        => _context.Receipts.Add(receipt).Entity;

    public void RemoveReceipt(Receipt receipt)
        => _context.Entry(receipt).State = EntityState.Detached;

    public async Task<int> GetLastReceiptNumberAsync(int branchId)
        => await _context.Receipts
            .Where(r => r.BranchId == branchId)
            .MaxAsync(r => (int?)r.Number) ?? 0;

    public async Task<Receipt?> FindReceiptByTicketAsync(int ticketId)
        => await _context.Receipts.FirstOrDefaultAsync(r => r.TicketId == ticketId);

    public async Task<PricingRules> GetPricingRulesAsync(int branchId)
        => (await _context.BranchPricings.AsNoTracking().FirstOrDefaultAsync(p => p.BranchId == branchId))?.Rules
           ?? PricingRules.None;

    public async Task<BranchPricing?> FindPricingAsync(int branchId)
        => await _context.BranchPricings.FirstOrDefaultAsync(p => p.BranchId == branchId);

    public BranchPricing AddPricing(BranchPricing pricing)
        => _context.BranchPricings.Add(pricing).Entity;

    public Refund AddRefund(Refund refund)
        => _context.Refunds.Add(refund).Entity;

    public void RemoveRefund(Refund refund)
    {
        foreach (var line in refund.Lines)
            _context.Entry(line).State = EntityState.Detached;

        _context.Entry(refund).State = EntityState.Detached;
    }

    public async Task<int> GetLastRefundNumberAsync(int branchId)
        => await _context.Refunds
            .Where(r => r.BranchId == branchId)
            .MaxAsync(r => (int?)r.Number) ?? 0;

    public async Task<IReadOnlyCollection<Refund>> GetRefundsForTicketAsync(int ticketId)
        => await _context.Refunds
            .AsNoTracking()
            .Where(r => r.TicketId == ticketId)
            .OrderBy(r => r.Number)
            .ToListAsync();
}
