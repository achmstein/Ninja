#nullable enable
using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when a customer is put on an
/// order after it was placed. Sales only needs who: the order's lines take
/// the new snapshot. The figures Loyalty reads off the same event are left
/// out; the account the order left, when it changed hands, is carried but
/// unused — the lines only ever show who they are for now.
/// </summary>
public record OrderCustomerAssignedIntegrationEvent(
    int OrderId,
    int BranchId,
    string? BuyerIdentityGuid,
    string? CustomerName,
    string? PreviousBuyerIdentityGuid = null) : IntegrationEvent;
