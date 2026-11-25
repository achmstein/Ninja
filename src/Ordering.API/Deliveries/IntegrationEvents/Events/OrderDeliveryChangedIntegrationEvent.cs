#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// A delivery moved on: given to a rider or taken from one, out of the door,
/// delivered, failed or brought back, its cash handed in. Notification.API
/// tells the rider it is theirs (or no longer), the customer when it leaves
/// and arrives, and the till's screens; Sales settles the bill in cash when
/// it is handed in. The address is the one piece of the customer's details
/// it carries, for the rider's push; nothing else of theirs travels.
/// </summary>
/// <param name="Stage">"Waiting", "Assigned", "OnTheWay", "Delivered", "Failed" or "Returned".</param>
/// <param name="PreviousRiderUserId">The rider who no longer has it, when it changed hands.</param>
/// <param name="CashHandedIn">The rider handed the cash in at the till: Sales settles the bill with it.</param>
/// <param name="Total">What the bill comes to, the delivery fee in; what the rider collects.</param>
/// <param name="Version">One more with every step of this order's delivery: a consumer ignores one older than what it has.</param>
/// <param name="CashCollected">What the rider handed in, as the till counted it, with <paramref name="CashHandedIn"/>.</param>
/// <param name="CourierProviderId">The courier company that has it instead of a rider; null while a rider has it, or nobody.</param>
/// <param name="CourierName">The courier the company sent, when it said: told to the customer where a rider's name would be.</param>
/// <param name="CourierFee">What the courier company charges the business for it.</param>
/// <param name="CourierCollectedReported">The courier company said what its courier collected: Sales settles the bill to the company.</param>
/// <param name="CourierCollected">What the courier collected at the door, with <paramref name="CourierCollectedReported"/>; zero when paid online ahead.</param>
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
    string? Address,
    int Version = 0,
    decimal? CashCollected = null,
    int? CourierProviderId = null,
    string? CourierProvider = null,
    string? CourierName = null,
    decimal? CourierFee = null,
    bool CourierCollectedReported = false,
    decimal? CourierCollected = null) : IntegrationEvent;
