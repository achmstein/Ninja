#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// A delivery moved on: given to a rider or taken from one, out of the door,
/// delivered, its cash handed in. Notification.API tells the rider it is
/// theirs (or no longer), the customer when it leaves and arrives, and the
/// till's screens; Sales settles the bill in cash when it is handed in.
/// </summary>
/// <param name="Stage">"Waiting", "Assigned", "OnTheWay" or "Delivered".</param>
/// <param name="PreviousRiderUserId">The rider who no longer has it, when it changed hands.</param>
/// <param name="CashHandedIn">The rider handed the cash in at the till: Sales settles the bill with it.</param>
/// <param name="Total">What the bill comes to, the delivery fee in; what the rider collects.</param>
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
