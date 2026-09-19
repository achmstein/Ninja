using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// An open ticket was voided — nothing was owed, nothing was paid. Loyalty
/// takes back what each order on it had earned at confirmation; the floor
/// nudge goes out separately, as for any change.
/// </summary>
/// <param name="OrderReversals">
/// Per order on the ticket: its menu value here, reversed in full — the same
/// shape a credit note carries, so Loyalty reverses both the same way. The
/// amount is the order's lines on this ticket, a share of the order when
/// some of its lines were moved to another bill. Empty when the ticket held
/// only room time or manual lines — those earned no points.
/// </param>
public record TicketVoidedIntegrationEvent(
    int TicketId,
    int BranchId,
    string Reason,
    string VoidedBy,
    IReadOnlyCollection<RefundOrderReversal> OrderReversals,
    int? PlaceId = null) : IntegrationEvent;
