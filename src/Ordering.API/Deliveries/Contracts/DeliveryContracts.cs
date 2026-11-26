#nullable enable

namespace Ninja.Ordering.API.Deliveries;

/// <param name="Delivers">The branch delivers right now (delivery on, taking orders).</param>
/// <param name="InRange">The point is inside the branch's drawn area when it has one, otherwise within its radius.</param>
/// <param name="RadiusKm">How far the branch delivers, straight-line; 0 when it has only a drawn area.</param>
/// <param name="SignInRequired">The branch delivers to signed-in customers only: a guest is asked to sign in first.</param>
/// <param name="HasArea">The branch delivers to an area drawn on the map, not a circle: "outside the area" rather than "beyond so many km".</param>
/// <param name="ZoneId">The branch's named area the point is in, when it is in one: Fee and MinimumOrder are then that area's.</param>
/// <param name="EtaMinutes">About how many minutes the area says a delivery there takes; null when unsaid or in no area.</param>
/// <param name="ZoneOff">The area is switched off for a while: the branch is not delivering there right now.</param>
public record DeliveryQuote(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm, bool SignInRequired = false, bool HasArea = false,
    int? ZoneId = null, LocalizedText? ZoneName = null, int? EtaMinutes = null, bool ZoneOff = false);

/// <summary>Which of the business's branches deliver to a point.</summary>
/// <param name="Delivers">Some branch delivers right now; false while the business does not deliver at all.</param>
/// <param name="Branches">The branches whose area (drawn, or the radius) takes the point in, nearest first; empty when none goes that far.</param>
public record DeliveryResolution(bool Delivers, IReadOnlyList<DeliveringBranch> Branches);

/// <param name="SignInRequired">The branch delivers to signed-in customers only.</param>
/// <param name="ZoneId">The branch's named area the point is in, when it is in one; Fee and MinimumOrder are then that area's.</param>
public record DeliveringBranch(int BranchId, int DistanceMeters, decimal Fee, decimal MinimumOrder, bool SignInRequired,
    int? ZoneId = null, LocalizedText? ZoneName = null, int? EtaMinutes = null, bool ZoneOff = false);

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
    bool HasArea = false,
    // The named area the delivery is in (picked by name, or the one the pin fell in): Fee and MinimumOrder are then its own
    int? ZoneId = null,
    LocalizedText? ZoneName = null,
    int? EtaMinutes = null,
    bool ZoneOff = false,
    // This branch's named areas, in the owner's order: what the cashier picks from by name
    IReadOnlyList<StaffDeliveryZone>? Zones = null);

/// <summary>The call centre's answer for a caller's address: which branches would take the delivery.</summary>
/// <param name="Delivers">Some branch delivers at all (paused ones included); false while the business does not deliver.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin read from the location; the till sends it with the order.</param>
/// <param name="LocationRead">False when a location was given but no point could be read from it.</param>
/// <param name="Branches">
/// The branches whose area takes the pin in, nearest first, paused ones too and
/// flagged: the call centre picks the first that is not paused, and the agent
/// may choose another. Empty without a pin, or when none goes that far.
/// </param>
/// <param name="Delivering">
/// Every branch that delivers at all, paused ones flagged, in branch order: what the agent picks from by
/// hand when the caller only says where they live and no point on the map is known, or when the point
/// falls outside every branch's area and the business sends it anyway.
/// </param>
public record StaffDeliveryResolution(
    bool Delivers,
    double? Latitude,
    double? Longitude,
    bool LocationRead,
    IReadOnlyList<DeliveryAlternative> Branches,
    IReadOnlyList<StaffDeliveringBranch> Delivering,
    // Every named area of every branch that delivers: the agent types the area the caller says and
    // gets the branch and the fee in one step. Empty for a business that lists none
    IReadOnlyList<StaffDeliveryZone>? Zones = null);

/// <summary>A named delivery area as staff pick it: which branch's it is and what a delivery there asks.</summary>
/// <param name="MinimumOrder">What holds there: the area's own minimum, or the branch's.</param>
/// <param name="On">False while the branch is not delivering there for a while: taken only on a second tap.</param>
/// <param name="BranchPaused">Its branch paused its customers' orders; a phone order may still go there.</param>
public record StaffDeliveryZone(int ZoneId, int BranchId, LocalizedText Name, decimal Fee, decimal MinimumOrder, int? EtaMinutes, bool On, bool BranchPaused, bool Drawn);

/// <summary>A branch that delivers, with what it asks: no distance, since no point is being measured to.</summary>
public record StaffDeliveringBranch(int BranchId, decimal Fee, decimal MinimumOrder, bool Paused);

/// <summary>Another branch that delivers to the caller's pin, with what it would ask.</summary>
/// <param name="DistanceMeters">From that branch to the pin, as the crow flies.</param>
/// <param name="Paused">The branch paused its orders: it still takes one sent from a till, but the cashier is asked twice.</param>
/// <param name="ZoneId">That branch's named area the pin is in, when it is in one; Fee and MinimumOrder are then that area's.</param>
public record DeliveryAlternative(int BranchId, int DistanceMeters, decimal Fee, decimal MinimumOrder, bool Paused,
    int? ZoneId = null, LocalizedText? ZoneName = null, int? EtaMinutes = null, bool ZoneOff = false);

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
/// <param name="PinSource">Where the pin came from: Customer (their own, saved in the app), Rider (where a rider handed an earlier delivery over), Shared, Search, or None.</param>
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
    DateTime? LastDeliveredAt,
    string PinSource = nameof(DeliveryPinSource.None));

/// <summary>The rider handed it over, and where their phone said they were when they said so (both or neither).</summary>
/// <param name="AccuracyMeters">How close the phone said it was; a fix further out than 100 m is not kept.</param>
public record DeliveredRequest(double? Latitude = null, double? Longitude = null, double? AccuracyMeters = null);

/// <summary>A location link made for a caller: the token goes in the link the till sends.</summary>
public record LocationShareCreated(string Token, DateTime ExpiresAt);

/// <summary>What the till reads of its location link: the caller's pin once they shared it.</summary>
public record LocationShareView(string Token, double? Latitude, double? Longitude, double? AccuracyMeters, DateTime? SharedAt, bool Expired);

/// <summary>What the caller's page reads of the link: whether it still takes a location, and whether one came.</summary>
public record LocationShareState(bool Open, bool Shared);

/// <summary>Where the caller's phone says they are.</summary>
public record ShareLocationRequest(double Latitude, double Longitude, double? AccuracyMeters = null);

/// <summary>Give a delivery to one of the branch's riders. The name is the rider's own, as Ordering knows them.</summary>
/// <param name="RiderName">Ignored: read for one release from tills that still send it.</param>
public record AssignRiderRequest(string RiderUserId, string? RiderName = null);

public record RiderStatusRequest(bool OnDuty);

/// <param name="Reason">What happened at the door, in the rider's or cashier's words.</param>
public record DeliveryFailedRequest(string? Reason = null);

/// <param name="Amount">What the rider handed in, as the till counted it.</param>
public record HandInCashRequest(decimal Amount);

/// <summary>Give a delivery to one of the business's courier companies instead of a rider.</summary>
/// <param name="ProviderId">One of the courier companies the business lists, switched on.</param>
/// <param name="CourierName">The courier the company sent, when it said.</param>
/// <param name="Fee">What it charges for this delivery; the company's usual fee when left out.</param>
public record AssignCourierRequest(int ProviderId, string? CourierName = null, string? CourierPhone = null, decimal? Fee = null);

/// <param name="Collected">What the courier collected at the door; ignored for an order paid online ahead.</param>
public record CourierDeliveredRequest(decimal Collected);

/// <summary>A courier company as the owner lists it.</summary>
/// <param name="DefaultFee">What it usually charges per delivery; the till may change it for one.</param>
public record CourierProviderRequest(string Name, string? Phone = null, decimal? DefaultFee = null, bool IsActive = true);

/// <summary>
/// A courier company the business hands deliveries to. Connected, a delivery given to it is sent to
/// its system, which says who it sends and each step; the till asks nothing more.
/// </summary>
public record CourierProviderView(int Id, string Name, string? Phone, decimal? DefaultFee, bool IsActive, bool IsConnected = false);

/// <summary>
/// Where a courier company's system takes Ninja's jobs, and the key it gave the business. An empty
/// address disconnects it (its key and signing secret are forgotten); a key left out keeps the one kept.
/// </summary>
public record CourierConnectionRequest(string? ApiBaseUrl, string? ApiKey = null);

/// <summary>
/// A company's connection as the owner sees it: never the key or the secret, only whether there is
/// one. StatusUrl is where the company sends its status; CanKeepSecrets is false on a stack with no
/// key to seal them with.
/// </summary>
public record CourierConnectionView(bool Connected, string? ApiBaseUrl, bool HasApiKey, bool HasWebhookSecret, string StatusUrl, bool CanKeepSecrets);

/// <summary>A new signing secret, shown this once: the company signs its status calls with it.</summary>
public record CourierWebhookSecretView(string Secret, string StatusUrl);

/// <summary>The cash a rider hands in for several deliveries at once: each delivery and what the till counted for it.</summary>
public record HandInRiderCashRequest(IReadOnlyList<HandInCashItem>? Items);

/// <summary>One delivery of a rider's hand-in, and its amount.</summary>
public record HandInCashItem(int OrderId, decimal Amount);

/// <summary>A delivery as the till's board and the rider see it: the order, what to collect, where to go.</summary>
public record DeliveryOrder
{
    public int OrderNumber { get; init; }
    /// <summary>The branch it leaves from: where a rider shared by branches collects the bag.</summary>
    public int BranchId { get; init; }
    public DateTime Date { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    /// <summary>The kitchen finished it: it can leave.</summary>
    public DateTime? ReadyAt { get; init; }
    /// <summary>
    /// Whether a kitchen screen will say when it is ready: true when part of it is on a screen, false
    /// when all of it went to kitchen printers (nobody marks those ready, so "not ready yet" would never
    /// change), null when the branch has no stations and the app goes by whether the business has screens.
    /// </summary>
    public bool? KitchenMarksReady { get; init; }
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
    /// <summary>The courier company it was with after this step, instead of a rider.</summary>
    public string? CourierProvider { get; init; }
    public string? CourierName { get; init; }
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
