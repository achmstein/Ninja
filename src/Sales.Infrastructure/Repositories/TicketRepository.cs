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

    public async Task<Ticket?> GetAsync(int ticketId)
        => await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);

    public async Task<Ticket?> FindOpenBySessionAsync(int sessionId)
        => await _context.Tickets
            .FirstOrDefaultAsync(t => t.SessionId == sessionId && t.Status == TicketStatus.Open);

    public async Task<Ticket?> FindOpenByTableAsync(int tableId, int branchId)
        => await _context.Tickets
            .FirstOrDefaultAsync(t => t.TableId == tableId && t.BranchId == branchId && t.Status == TicketStatus.Open);

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
}
