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
}

/// <summary>
/// The business's own delivery of an order: where it goes, as the customer
/// pinned and described it, what it adds to the bill, and the rider who
/// takes it. Snapshotted at order time — a saved address edited later never
/// moves an order already on its way. Paid in cash at the door: the rider
/// carries it back and the till takes it, which settles the bill.
/// </summary>
public class Delivery
{
    public double Latitude { get; private set; }

    public double Longitude { get; private set; }

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

    /// <summary>Straight-line from the branch, when the order was placed.</summary>
    public int DistanceMeters { get; private set; }

    /// <summary>The rider's account (the token's subject); null until someone is given it.</summary>
    public string? RiderUserId { get; private set; }

    public string? RiderName { get; private set; }

    public DateTime? AssignedAt { get; private set; }

    public DateTime? OutAt { get; private set; }

    public DateTime? DeliveredAt { get; private set; }

    /// <summary>The till took the cash from the rider; the bill is settled with it.</summary>
    public DateTime? CashHandedInAt { get; private set; }

    public DeliveryStage Stage =>
        DeliveredAt != null ? DeliveryStage.Delivered
        : OutAt != null ? DeliveryStage.OnTheWay
        : RiderUserId != null ? DeliveryStage.Assigned
        : DeliveryStage.Waiting;

    protected Delivery() { }

    public Delivery(
        double latitude,
        double longitude,
        string address,
        string? building,
        string? floor,
        string? apartment,
        string? directions,
        string phone,
        decimal fee,
        int distanceMeters)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180)
            throw new OrderingDomainException("A delivery needs a point on the map.");

        Latitude = latitude;
        Longitude = longitude;
        Address = !string.IsNullOrWhiteSpace(address)
            ? address.Trim()
            : throw new OrderingDomainException("A delivery needs the area and street.");
        Building = Tidy(building);
        Floor = Tidy(floor);
        Apartment = Tidy(apartment);
        Directions = Tidy(directions);
        Phone = !string.IsNullOrWhiteSpace(phone)
            ? phone.Trim()
            : throw new OrderingDomainException("A delivery needs a phone number to call at the door.");
        Fee = fee >= 0 ? fee : throw new OrderingDomainException("A delivery fee can't be below zero.");
        DistanceMeters = Math.Max(0, distanceMeters);
    }

    private static string? Tidy(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Give it to a rider, or to another one before it leaves. Returns the
    /// rider it was taken from, if any.
    /// </summary>
    internal string? AssignRider(string riderUserId, string riderName, DateTime at)
    {
        if (OutAt != null)
            throw new OrderingDomainException("The order has left with its rider; it can't be given to another.");
        if (string.IsNullOrWhiteSpace(riderUserId))
            throw new OrderingDomainException("Say which rider takes it.");

        var previous = RiderUserId;
        RiderUserId = riderUserId;
        RiderName = string.IsNullOrWhiteSpace(riderName) ? null : riderName.Trim();
        AssignedAt = at;
        return previous;
    }

    /// <summary>Take it back from its rider before it leaves.</summary>
    internal string? Unassign()
    {
        if (OutAt != null)
            throw new OrderingDomainException("The order has left with its rider.");

        var previous = RiderUserId;
        RiderUserId = null;
        RiderName = null;
        AssignedAt = null;
        return previous;
    }

    internal bool MarkOut(DateTime at)
    {
        if (RiderUserId is null)
            throw new OrderingDomainException("Give the order to a rider before it leaves.");
        if (OutAt != null)
            return false;
        OutAt = at;
        return true;
    }

    internal bool MarkDelivered(DateTime at)
    {
        if (DeliveredAt != null)
            return false;
        if (OutAt is null)
            throw new OrderingDomainException("The order hasn't left yet.");
        DeliveredAt = at;
        return true;
    }

    internal bool MarkCashHandedIn(DateTime at)
    {
        if (CashHandedInAt != null)
            return false;
        if (DeliveredAt is null)
            throw new OrderingDomainException("The order hasn't been delivered yet.");
        CashHandedInAt = at;
        return true;
    }
}
