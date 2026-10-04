#nullable enable

namespace Ninja.Ordering.API.Deliveries;

/// <param name="Delivers">The branch delivers right now (delivery on, taking orders).</param>
/// <param name="InRange">The point is within the branch's radius.</param>
public record DeliveryQuote(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm);

/// <summary>The branch's answer for a delivery the till takes over the phone.</summary>
/// <param name="InRange">Within the radius; true without a pin, where the cashier knows the streets.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin read from the pasted location; the till sends it with the order.</param>
/// <param name="LocationRead">False when a location was pasted but no point could be read from it.</param>
public record TillDeliveryQuote(
    bool Delivers,
    bool InRange,
    int? DistanceMeters,
    decimal Fee,
    decimal MinimumOrder,
    decimal RadiusKm,
    double? Latitude,
    double? Longitude,
    bool LocationRead);

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
    /// <summary>What the rider collects at the door, the fee in.</summary>
    public decimal Total { get; init; }
    /// <summary>What the rider handed in less <see cref="Total"/>, once the cash is in: below zero, short.</summary>
    public decimal? CashDifference { get; init; }
    public List<Orderitem> Items { get; init; } = new();
    public DeliveryStaffView Delivery { get; init; } = new();
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
