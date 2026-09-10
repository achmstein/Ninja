#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

public interface ITicketRepository : IRepository<Ticket>
{
    Ticket Add(Ticket ticket);

    /// <summary>Delete a discarded ticket outright — see <see cref="Ticket.Discard"/>.</summary>
    void Remove(Ticket ticket);

    Task<Ticket?> GetAsync(int ticketId);

    /// <summary>The open ticket billing a room session, if one exists.</summary>
    Task<Ticket?> FindOpenBySessionAsync(int sessionId);

    /// <summary>The open ticket accumulating for a table, if one exists.</summary>
    Task<Ticket?> FindOpenByTableAsync(int tableId, int branchId);

    /// <summary>
    /// The open counter ticket in a branch that already carries lines for a
    /// customer — by account, or by guest id for a guest — so a second
    /// order-ahead before they pay joins the first instead of opening a new
    /// tab. Null when they have none open (or nobody was identified).
    /// </summary>
    Task<Ticket?> FindOpenCounterForCustomerAsync(int branchId, string? customerId, string? guestId);

    /// <summary>
    /// Whether any ticket already carries a confirmed order's lines — the
    /// dedupe for a redelivered confirmation, across tickets because the
    /// lines may have moved since they first landed.
    /// </summary>
    Task<bool> HasOrderAsync(int orderId);

    /// <summary>
    /// Every ticket carrying a confirmed order's lines — normally one, more
    /// when some of them were moved onto another bill since they landed.
    /// </summary>
    Task<IReadOnlyCollection<Ticket>> FindByOrderAsync(int orderId);

    Receipt AddReceipt(Receipt receipt);

    /// <summary>Detach a receipt that lost the numbering race, before retrying.</summary>
    void RemoveReceipt(Receipt receipt);

    /// <summary>Highest receipt number issued for a branch so far (0 when none).</summary>
    Task<int> GetLastReceiptNumberAsync(int branchId);

    Task<Receipt?> FindReceiptByTicketAsync(int ticketId);

    /// <summary>The branch's rules, or <see cref="PricingRules.None"/> when it never set any.</summary>
    Task<PricingRules> GetPricingRulesAsync(int branchId);

    Task<BranchPricing?> FindPricingAsync(int branchId);

    BranchPricing AddPricing(BranchPricing pricing);

    Refund AddRefund(Refund refund);

    /// <summary>Detach a credit note that lost the numbering race, before retrying.</summary>
    void RemoveRefund(Refund refund);

    /// <summary>Highest credit note number issued for a branch so far (0 when none).</summary>
    Task<int> GetLastRefundNumberAsync(int branchId);

    Task<IReadOnlyCollection<Refund>> GetRefundsForTicketAsync(int ticketId);
}
