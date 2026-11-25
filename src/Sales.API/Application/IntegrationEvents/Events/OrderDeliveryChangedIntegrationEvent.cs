#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a delivery moved on. Sales only acts
/// when the rider's cash was handed in at the till, which settles the bill,
/// and on a courier company's delivery when its courier's collection is said
/// (the bill settles to the company) or it could not be handed over (the
/// company's fee is still owed).
/// Only what Sales reads is kept here: no address, no customer.
/// </summary>
/// <param name="Version">Ordering's count of the delivery's moves; a later one carries a higher number.</param>
/// <param name="CashCollected">What the rider brought back; null from an Ordering older than it, when <paramref name="Total"/> stands in.</param>
public record OrderDeliveryChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Stage,
    string? RiderUserId,
    string? RiderName,
    bool CashHandedIn,
    decimal Total,
    int Version = 0,
    decimal? CashCollected = null,
    int? CourierProviderId = null,
    string? CourierProvider = null,
    decimal? CourierFee = null,
    bool CourierCollectedReported = false,
    decimal? CourierCollected = null) : IntegrationEvent;
