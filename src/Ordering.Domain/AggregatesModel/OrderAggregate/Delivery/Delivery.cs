#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>Where a delivery has got to; worked out from its times, never stored.</summary>
public enum DeliveryStage
{
    /// <summary>Nobody has been given it yet.</summary>
    Waiting = 0,

    /// <summary>A rider has it, not yet left.</summary>
    Assigned = 1,

    /// <summary>The rider left with it.</summary>
    OnTheWay = 2,

    /// <summary>The customer has it; the rider holds the cash until the till takes it.</summary>
    Delivered = 3,

    /// <summary>It could not be handed over: nobody answered, the customer refused it.</summary>
    Failed = 4,

    /// <summary>The rider brought it back to the branch.</summary>
    Returned = 5,
}

/// <summary>
/// The business's own delivery of an order: where it goes, as the customer
/// pinned and described it, what it adds to the bill, and the rider who
/// takes it. Snapshotted at order time — a saved address edited later never
/// moves an order already on its way. Paid in cash at the door: the rider
/// carries it back and the till takes it, which settles the bill. Every step
/// moves <see cref="Version"/> on, so two people moving the same delivery at
/// once cannot both win.
/// </summary>
public class Delivery
{
    /// <summary>The pin; null for an address the till took down over the phone without one.</summary>
    public double? Latitude { get; private set; }

    public double? Longitude { get; private set; }

    /// <summary>The area and street, in the customer's words.</summary>
    public string Address { get; private set; } = string.Empty;

    public string? Building { get; private set; }

    public string? Floor { get; private set; }

    public string? Apartment { get; private set; }

    /// <summary>Anything else that finds the door: a landmark, the gate's colour.</summary>
    public string? Directions { get; private set; }

    /// <summary>The number the rider calls on arrival.</summary>
    public string Phone { get; private set; } = string.Empty;

    /// <summary>What the delivery adds to the bill; the branch's fee when the order was placed.</summary>
    public decimal Fee { get; private set; }

    /// <summary>Straight-line from the branch, when the order was placed; null without a pin.</summary>
    public int? DistanceMeters { get; private set; }

    /// <summary>The rider's account (the token's subject); null until someone is given it.</summary>
    public string? RiderUserId { get; private set; }

    public string? RiderName { get; private set; }

    public DateTime? AssignedAt { get; private set; }

    public DateTime? OutAt { get; private set; }

    public DateTime? DeliveredAt { get; private set; }

    /// <summary>It could not be handed over, and why.</summary>
    public DateTime? FailedAt { get; private set; }

    public string? FailureReason { get; private set; }

    /// <summary>The rider brought it back to the branch.</summary>
    public DateTime? ReturnedAt { get; private set; }

    /// <summary>The till took the cash from the rider; the bill is settled with it.</summary>
    public DateTime? CashHandedInAt { get; private set; }

    /// <summary>What the rider handed in, as the till counted it; null before.</summary>
    public decimal? CashCollected { get; private set; }

    /// <summary>One more with every step: the order's delivery as of a moment, and the guard against two moving it at once.</summary>
    public int Version { get; private set; }

    public DeliveryStage Stage =>
        ReturnedAt != null ? DeliveryStage.Returned
        : FailedAt != null ? DeliveryStage.Failed
        : DeliveredAt != null ? DeliveryStage.Delivered
        : OutAt != null ? DeliveryStage.OnTheWay
        : RiderUserId != null ? DeliveryStage.Assigned
        : DeliveryStage.Waiting;

    /// <summary>Nothing more will happen to it: delivered, or brought back.</summary>
    public bool IsFinished => DeliveredAt != null || ReturnedAt != null;

    protected Delivery() { }

    /// <param name="latitude">With <paramref name="longitude"/>, the pin; both or neither.</param>
    /// <param name="distanceMeters">From the branch to the pin; ignored without one.</param>
    public Delivery(
        double? latitude,
        double? longitude,
        string address,
        string? building,
        string? floor,
        string? apartment,
        string? directions,
        string phone,
        decimal fee,
        int? distanceMeters)
    {
        if (latitude.HasValue != longitude.HasValue
            || latitude is < -90 or > 90 || longitude is < -180 or > 180
            || latitude is double.NaN || longitude is double.NaN)
            throw new OrderingDomainException("A delivery needs a point on the map.", DeliveryErrors.PinInvalid);

        Latitude = latitude;
        Longitude = longitude;
        Address = !string.IsNullOrWhiteSpace(address)
            ? Limit(address, DeliveryLimits.Address, "area and street")
            : throw new OrderingDomainException("A delivery needs the area and street.", DeliveryErrors.AddressRequired);
        Building = Tidy(building, DeliveryLimits.Building, "building");
        Floor = Tidy(floor, DeliveryLimits.Floor, "floor");
        Apartment = Tidy(apartment, DeliveryLimits.Apartment, "apartment");
        Directions = Tidy(directions, DeliveryLimits.Directions, "directions");
        Phone = !string.IsNullOrWhiteSpace(phone)
            ? Limit(phone, DeliveryLimits.Phone, "phone")
            : throw new OrderingDomainException("A delivery needs a phone number to call at the door.", DeliveryErrors.PhoneInvalid);
        Fee = fee >= 0 ? fee : throw new OrderingDomainException("A delivery fee can't be below zero.");
        DistanceMeters = latitude is null || distanceMeters is null ? null : Math.Max(0, distanceMeters.Value);
    }

    private static string? Tidy(string? value, int max, string what) =>
        string.IsNullOrWhiteSpace(value) ? null : Limit(value, max, what);

    private static string Limit(string value, int max, string what)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= max
            ? trimmed
            : throw new OrderingDomainException($"The {what} is longer than {max} characters.", DeliveryErrors.TooLong);
    }

    /// <summary>
    /// Give it to a rider, or to another before it leaves. Returns the
    /// rider it was taken from, if any.
    /// </summary>
    internal string? AssignRider(string riderUserId, string riderName, DateTime at)
    {
        if (OutAt != null)
            throw new OrderingDomainException("The order has left with its rider; it can't be given to another.", DeliveryErrors.AlreadyOut);
        if (string.IsNullOrWhiteSpace(riderUserId))
            throw new OrderingDomainException("Say which rider takes it.", DeliveryErrors.RiderUnknown);

        var previous = RiderUserId;
        RiderUserId = Limit(riderUserId, DeliveryLimits.RiderUserId, "rider");
        RiderName = string.IsNullOrWhiteSpace(riderName) ? null : Limit(riderName, DeliveryLimits.RiderName, "rider's name");
        AssignedAt = at;
        Version++;
        return previous;
    }

    /// <summary>Take it back from its rider before it leaves.</summary>
    internal string? Unassign()
    {
        if (OutAt != null)
            throw new OrderingDomainException("The order has left with its rider.", DeliveryErrors.AlreadyOut);

        var previous = RiderUserId;
        RiderUserId = null;
        RiderName = null;
        AssignedAt = null;
        Version++;
        return previous;
    }

    internal bool MarkOut(DateTime at)
    {
        if (RiderUserId is null)
            throw new OrderingDomainException("Give the order to a rider before it leaves.", DeliveryErrors.NoRider);
        if (OutAt != null)
            return false;
        OutAt = at;
        Version++;
        return true;
    }

    internal bool MarkDelivered(DateTime at)
    {
        if (DeliveredAt != null)
            return false;
        if (OutAt is null || FailedAt != null || ReturnedAt != null)
            throw new OrderingDomainException("The order isn't on its way.", DeliveryErrors.NotOut);
        DeliveredAt = at;
        Version++;
        return true;
    }

    /// <summary>It could not be handed over. Only on the way; a repeat is a no-op.</summary>
    internal bool MarkFailed(string reason, DateTime at)
    {
        if (FailedAt != null)
            return false;
        if (DeliveredAt != null)
            throw new OrderingDomainException("The order has been delivered.", DeliveryErrors.AlreadyDelivered);
        if (OutAt is null)
            throw new OrderingDomainException("The order hasn't left yet.", DeliveryErrors.NotOut);

        FailureReason = string.IsNullOrWhiteSpace(reason) ? null : Limit(reason, DeliveryLimits.FailureReason, "reason");
        FailedAt = at;
        Version++;
        return true;
    }

    /// <summary>The rider brought it back, failed or not handed over. A repeat is a no-op.</summary>
    internal bool MarkReturned(DateTime at)
    {
        if (ReturnedAt != null)
            return false;
        if (DeliveredAt != null)
            throw new OrderingDomainException("The order has been delivered.", DeliveryErrors.AlreadyDelivered);
        if (OutAt is null)
            throw new OrderingDomainException("The order hasn't left yet.", DeliveryErrors.NotOut);

        ReturnedAt = at;
        Version++;
        return true;
    }

    /// <summary>The rider handed in what they collected. A repeat is a no-op.</summary>
    internal bool MarkCashHandedIn(decimal amount, DateTime at)
    {
        if (CashHandedInAt != null)
            return false;
        if (DeliveredAt is null)
            throw new OrderingDomainException("The order hasn't been delivered yet.", DeliveryErrors.NotDelivered);
        if (amount < 0)
            throw new OrderingDomainException("The cash handed in can't be below zero.", DeliveryErrors.CashInvalid);

        CashCollected = amount;
        CashHandedInAt = at;
        Version++;
        return true;
    }
}
