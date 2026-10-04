#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a delivery moved on. Sales only acts
/// when the rider's cash was handed in at the till, which settles the bill.
/// </summary>
public record OrderDeliveryChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Stage,
    string? RiderUserId,
    string? RiderName,
    string? PreviousRiderUserId,
    string? BuyerIdentityGuid,
    string? GuestId,
    bool CashHandedIn,
    decimal Total,
    string? Address) : IntegrationEvent;
