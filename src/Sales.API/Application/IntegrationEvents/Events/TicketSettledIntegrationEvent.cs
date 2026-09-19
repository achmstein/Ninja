using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A ticket was paid and frozen. Besides the floor refresh, this is the seam
/// Accounts posts account-tender charges from.
/// </summary>
/// <param name="AccountCharges">
/// One entry per tab the settle charged, because a shared bill can put
/// Ahmed's share on his account and Sara's on hers. Accounts posts exactly
/// these — never the whole total, which may also contain cash or card parts.
/// Empty when nothing went on account.
/// </param>
/// <param name="TimeTotal">
/// The session-time portion of the total (0 for table/counter tickets), kept
/// so a settled room bill can be reported on without re-deriving it from the
/// lines. Nothing accrues loyalty from it: points are earned by ordering, not
/// by booking a room (the item portion accrues when each order is confirmed).
/// </param>
/// <param name="OrderIds">
/// The orders the receipt covered, so Ordering can stamp each as paid for
/// the customer who placed it. Empty for a bill of counter lines only.
/// </param>
/// <param name="SessionId">The room session (Spaces reservation) the bill was for, if any.</param>
/// <param name="Tender">"Cash", "Card", "InstaPay", "Account", or "Mixed" — one word for the customer's screens.</param>
/// <param name="PlaceId">The Spaces place the bill was for, if any: paying it is what ends a sitting at a table, for everyone at it.</param>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Total,
    string? SettledBy = null,
    decimal TimeTotal = 0,
    IReadOnlyCollection<TicketAccountCharge>? AccountCharges = null,
    decimal Subtotal = 0,
    decimal ServiceCharge = 0,
    decimal Vat = 0,
    IReadOnlyCollection<int>? OrderIds = null,
    int? SessionId = null,
    string? Tender = null,
    DateTime SettledAt = default,
    int? PlaceId = null) : IntegrationEvent;

/// <summary>What one account holder's share of a settled ticket came to.</summary>
public record TicketAccountCharge(string CustomerId, string? CustomerName, decimal Amount);
