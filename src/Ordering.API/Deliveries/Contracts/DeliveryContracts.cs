#nullable enable

namespace Ninja.Ordering.API.Deliveries;

/// <param name="Delivers">The branch delivers right now (delivery on, taking orders).</param>
/// <param name="InRange">The point is inside the branch's drawn area when it has one, otherwise within its radius.</param>
/// <param name="RadiusKm">How far the branch delivers, straight-line; 0 when it has only a drawn area.</param>
/// <param name="SignInRequired">The branch delivers to signed-in customers only: a guest is asked to sign in first.</param>
/// <param name="HasArea">The branch delivers to an area drawn on the map, not a circle: "outside the area" rather than "beyond so many km".</param>
public record DeliveryQuote(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm, bool SignInRequired = false, bool HasArea = false);

/// <summary>Which of the business's branches deliver to a point.</summary>
/// <param name="Delivers">Some branch delivers right now; false while the business does not deliver at all.</param>
/// <param name="Branches">The branches whose area (drawn, or the radius) takes the point in, nearest first; empty when none goes that far.</param>
public record DeliveryResolution(bool Delivers, IReadOnlyList<DeliveringBranch> Branches);

/// <param name="SignInRequired">The branch delivers to signed-in customers only.</param>
public record DeliveringBranch(int BranchId, int DistanceMeters, decimal Fee, decimal MinimumOrder, bool SignInRequired);

/// <summary>The branch's answer for a delivery the till takes over the phone.</summary>
/// <param name="InRange">Inside the drawn area, or within the radius without one; true without a pin, where the cashier knows the streets.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin read from the pasted location; the till sends it with the order.</param>
/// <param name="LocationRead">False when a location was pasted but no point could be read from it.</param>
/// <param name="Alternatives">
/// The business's other branches that deliver to the pin, nearest first, when
/// it is out of this branch's area or one of them is clearly nearer
/// (<see cref="DeliveryAlternatives"/>); the till offers to send the order there.
/// Empty without a pin, and always while a call centre takes the business's
/// phone orders: then the calls come through the hotline, not a branch.
/// </param>
/// <param name="HasArea">The branch delivers to an area drawn on the map, not a circle: the till says "outside the branch's delivery area" rather than a radius.</param>
public record TillDeliveryQuote(
    bool Delivers,
    bool InRange,
    int? DistanceMeters,
    decimal Fee,
    decimal MinimumOrder,
    decimal RadiusKm,
    double? Latitude,
    double? Longitude,
    bool LocationRead,
    IReadOnlyList<DeliveryAlternative> Alternatives,
    bool HasArea = false);

/// <summary>The call centre's answer for a caller's address: which branches would take the delivery.</summary>
/// <param name="Delivers">Some branch delivers at all (paused ones included); false while the business does not deliver.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin read from the location; the till sends it with the order.</param>
/// <param name="LocationRead">False when a location was given but no point could be read from it.</param>
/// <param name="Branches">
/// The branches whose area takes the pin in, nearest first, paused ones too and
/// flagged: the call centre picks the first that is not paused, and the agent
/// may choose another. Empty without a pin, or when none goes that far.
/// </param>
public record StaffDeliveryResolution(
    bool Delivers,
    double? Latitude,
    double? Longitude,
    bool LocationRead,
    IReadOnlyList<DeliveryAlternative> Branches);

/// <summary>Another branch that delivers to the caller's pin, with what it would ask.</summary>
/// <param name="DistanceMeters">From that branch to the pin, as the crow flies.</param>
/// <param name="Paused">The branch paused its orders: it still takes one sent from a till, but the cashier is asked twice.</param>
public record DeliveryAlternative(int BranchId, int DistanceMeters, decimal Fee, decimal MinimumOrder, bool Paused);

public record CustomerAddressRequest(
    double Latitude,
    double Longitude,
    string Address,
    string? Building = null,
    string? Floor = null,
    string? Apartment = null,
    string? Directions = null,
    string? Phone = null,
    string? Label = null);

public record CustomerAddressView(
    int Id,
    string? Label,
    double Latitude,
    double Longitude,
    string Address,
    string? Building,
    string? Floor,
    string? Apartment,
    string? Directions,
    string? Phone)
{
    public static CustomerAddressView From(CustomerAddress a) =>
        new(a.Id, a.Label, a.Latitude, a.Longitude, a.Address, a.Building, a.Floor, a.Apartment, a.Directions, a.Phone);
}

/// <summary>An address a caller had before: one they saved (with its label), or one an earlier delivery here went to (with when).</summary>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin; null for one the till took over the phone without one.</param>
public record KnownAddressView(
    string? Label,
    double? Latitude,
    double? Longitude,
    string Address,
    string? Building,
    string? Floor,
    string? Apartment,
    string? Directions,
    string? Phone,
    DateTime? LastDeliveredAt);

/// <summary>Give a delivery to one of the branch's riders. The name is the rider's own, as Ordering knows them.</summary>
/// <param name="RiderName">Ignored: read for one release from tills that still send it.</param>
public record AssignRiderRequest(string RiderUserId, string? RiderName = null);

public record RiderStatusRequest(bool OnDuty);

/// <param name="Reason">What happened at the door, in the rider's or cashier's words.</param>
public record DeliveryFailedRequest(string? Reason = null);

/// <param name="Amount">What the rider handed in, as the till counted it.</param>
public record HandInCashRequest(decimal Amount);

/// <summary>The cash a rider hands in for several deliveries at once: each delivery and what the till counted for it.</summary>
public record HandInRiderCashRequest(IReadOnlyList<HandInCashItem>? Items);

/// <summary>One delivery of a rider's hand-in, and its amount.</summary>
public record HandInCashItem(int OrderId, decimal Amount);

/// <summary>A delivery as the till's board and the rider see it: the order, what to collect, where to go.</summary>
public record DeliveryOrder
{
    public int OrderNumber { get; init; }
    public DateTime Date { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    /// <summary>The kitchen finished it: it can leave.</summary>
    public DateTime? ReadyAt { get; init; }
    /// <summary>The bill was settled.</summary>
    public DateTime? PaidAt { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerNote { get; init; }
    /// <summary>The cashier who took the phone order, by name; null for one from the apps.</summary>
    public string? TakenByName { get; init; }
    /// <summary>The branch whose till took it and sent it here; null when it was taken here.</summary>
    public int? TakenAtBranchId { get; init; }
    /// <summary>What the order comes to, the fee in.</summary>
    public decimal Total { get; init; }
    /// <summary>Paid online in the app before the business saw it: the rider collects nothing, and no cash is handed in for it.</summary>
    public bool PaidOnline { get; init; }
    /// <summary>What the rider collects at the door: the total, or nothing when it was paid online.</summary>
    public decimal ToCollect { get; init; }
    /// <summary>What the rider handed in less <see cref="Total"/>, once the cash is in: below zero, short.</summary>
    public decimal? CashDifference { get; init; }
    public List<Orderitem> Items { get; init; } = new();
    public DeliveryStaffView Delivery { get; init; } = new();
}

/// <summary>A rider as the admin's Riders page reads them: where they stand now, and their day.</summary>
public record RiderOverview
{
    public string UserId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    /// <summary>False for an account disabled in Staff: listed, but given nothing.</summary>
    public bool Enabled { get; init; }
    /// <summary>"Online" (on duty here, heard lately), "Quiet" (on duty here, not heard lately) or "Off".</summary>
    public string Status { get; init; } = string.Empty;
    public bool OnDuty { get; init; }
    public DateTime? LastSeenAt { get; init; }
    /// <summary>Their app has checked in at least once.</summary>
    public bool SignedIn { get; init; }
    /// <summary>Deliveries with them not yet delivered or brought back.</summary>
    public int Out { get; init; }
    /// <summary>Delivered since the start of the caller's day.</summary>
    public int DeliveredToday { get; init; }
    /// <summary>Could not be handed over, since the start of the caller's day.</summary>
    public int FailedToday { get; init; }
    /// <summary>Cash they handed in at the till since the start of the caller's day.</summary>
    public decimal CashCollectedToday { get; init; }
}

/// <summary>One delivery in a rider's history.</summary>
public record RiderDeliveryRow
{
    public int OrderNumber { get; init; }
    public string? CustomerName { get; init; }
    public string Address { get; init; } = string.Empty;
    public string? Building { get; init; }
    public string? Floor { get; init; }
    public string? Apartment { get; init; }
    /// <summary>What the order comes to, the fee in: what the rider collects at the door, unless <see cref="PaidOnline"/>.</summary>
    public decimal Total { get; init; }
    /// <summary>Paid online in the app before the business saw it: the rider collected nothing for it.</summary>
    public bool PaidOnline { get; init; }
    public decimal Fee { get; init; }
    /// <summary>
    /// Where it stands for this rider: the delivery's own stage while it is still
    /// theirs ("Assigned", "OnTheWay", "Delivered", "Failed", "Returned"), or
    /// "TakenBack" / "GivenToOther" when it was taken from them before it left.
    /// </summary>
    public string Stage { get; init; } = string.Empty;
    /// <summary>When it was given to this rider.</summary>
    public DateTime AssignedAt { get; init; }
    /// <summary>The delivery is still with this rider.</summary>
    public bool StillWithRider { get; init; }
    /// <summary>When it was taken from this rider, if it was (taken back, or given to another).</summary>
    public DateTime? TakenFromRiderAt { get; init; }
    /// <summary>The rider it was given to instead, if it was.</summary>
    public string? GivenToRiderName { get; init; }
    public DateTime? OutAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? FailedAt { get; init; }
    public DateTime? ReturnedAt { get; init; }
    public string? FailureReason { get; init; }
    public decimal? CashCollected { get; init; }
    public DateTime? CashHandedInAt { get; init; }
    /// <summary>Handed in less the total: below zero, short.</summary>
    public decimal? CashDifference { get; init; }
    /// <summary>From leaving to handing it over, in whole minutes.</summary>
    public int? MinutesOutToDelivered { get; init; }
}

/// <summary>One step of a delivery, as its history recorded it.</summary>
public record DeliveryTimelineStep
{
    /// <summary>"Assigned", "Unassigned", "Reassigned", "Out", "Delivered", "Failed", "Returned" or "CashIn".</summary>
    public string Action { get; init; } = string.Empty;
    public DateTime At { get; init; }
    /// <summary>The rider it is with after the step; null once taken back.</summary>
    public string? RiderUserId { get; init; }
    public string? RiderName { get; init; }
    /// <summary>The rider it was taken from, when the step changed hands.</summary>
    public string? PreviousRiderUserId { get; init; }
    public string? PreviousRiderName { get; init; }
    public string? ActorUserId { get; init; }
    public string? ActorName { get; init; }
    /// <summary>"Rider" or "Till".</summary>
    public string ActorRole { get; init; } = string.Empty;
    public decimal? CashCollected { get; init; }
    public string? Reason { get; init; }
}

/// <summary>A window of a rider's deliveries: its figures over the whole window.</summary>
public record RiderHistorySummary(
    int Delivered,
    int Failed,
    int Returned,
    decimal CashCollected,
    decimal CashDifferenceTotal,
    double? AverageMinutesOutToDelivered);

/// <summary>A page of a rider's deliveries, newest first.</summary>
public record RiderDeliveryHistory
{
    public List<RiderDeliveryRow> Items { get; init; } = new();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public RiderHistorySummary Summary { get; init; } = new(0, 0, 0, 0, 0, null);
}

public record RiderView
{
    public string UserId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public bool OnDuty { get; init; }
    /// <summary>When their app was last heard from; null for a rider whose app never opened.</summary>
    public DateTime? LastSeenAt { get; init; }
    /// <summary>Their app has checked in at least once; false for a rider only just added.</summary>
    public bool SignedIn { get; init; }
    /// <summary>Deliveries they have that are not delivered or brought back yet.</summary>
    public int Out { get; init; }
}
