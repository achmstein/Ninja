using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A ticket was paid and frozen. Besides the floor refresh, this is the seam
/// Accounts posts account-tender charges from, and the one
/// loyalty-on-session-time would hang off.
/// </summary>
/// <param name="AccountAmount">
/// The part settled on the customer's account tab (0 when none). Accounts
/// posts exactly this as a Charge — never the whole total, which may also
/// contain cash or card parts.
/// </param>
/// <param name="TimeTotal">
/// The session-time portion of the total (0 for table/counter tickets).
/// Loyalty accrues on this — the item portion already accrued when each
/// order was confirmed, so awarding on the whole total would double-count.
/// </param>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Total,
    string? CustomerId,
    string? CustomerName = null,
    decimal AccountAmount = 0,
    string? SettledBy = null,
    decimal TimeTotal = 0) : IntegrationEvent;
