#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

public interface ITicketRepository : IRepository<Ticket>
{
    Ticket Add(Ticket ticket);

    Task<Ticket?> GetAsync(int ticketId);

    /// <summary>The open ticket billing a room session, if one exists.</summary>
    Task<Ticket?> FindOpenBySessionAsync(int sessionId);

    /// <summary>The open ticket accumulating for a table, if one exists.</summary>
    Task<Ticket?> FindOpenByTableAsync(int tableId, int branchId);

    Receipt AddReceipt(Receipt receipt);

    /// <summary>Detach a receipt that lost the numbering race, before retrying.</summary>
    void RemoveReceipt(Receipt receipt);

    /// <summary>Highest receipt number issued for a branch so far (0 when none).</summary>
    Task<int> GetLastReceiptNumberAsync(int branchId);

    Task<Receipt?> FindReceiptByTicketAsync(int ticketId);
}
