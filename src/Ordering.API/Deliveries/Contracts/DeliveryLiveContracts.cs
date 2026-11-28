#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>Where the rider's phone is, while they have a delivery out.</summary>
/// <param name="AccuracyMeters">How sure the phone is; a fix too vague is passed over.</param>
public record RiderLocationRequest(double Latitude, double Longitude, double? AccuracyMeters = null);

/// <summary>What the rider's phone is told back.</summary>
/// <param name="Out">How many deliveries the rider has on the way: at 0 the phone stops reporting.</param>
public record RiderLocationResult(int Out);

/// <summary>
/// A delivery as the customer's live card reads it: where it has got to, who
/// is bringing it and how to ring them while they are, how far along it is.
/// Never where the rider is.
/// </summary>
public record DeliveryLiveView
{
    public int OrderId { get; init; }
    /// <summary>"Waiting", "Assigned", "OnTheWay", "Delivered", "Failed" or "Returned".</summary>
    public string Stage { get; init; } = string.Empty;
    /// <summary>One more with every step: a card ignores anything older than what it shows.</summary>
    public int Version { get; init; }
    /// <summary>The rider, or the courier a company sent.</summary>
    public string? RiderName { get; init; }
    /// <summary>Their number, from being given the delivery until it is handed over; null otherwise, or when none is kept.</summary>
    public string? RiderPhone { get; init; }
    /// <summary>0 to 100, the share of the way covered, while on the way; null when it cannot be said.</summary>
    public int? Progress { get; init; }
    /// <summary>About how many minutes are left: the area's in full before it leaves, less as the rider nears.</summary>
    public int? EtaMinutes { get; init; }
    /// <summary>The rider has been near the door.</summary>
    public bool Nearby { get; init; }
    /// <summary>The customer said they are coming down.</summary>
    public bool CustomerComing { get; init; }
    /// <summary>Why it could not be handed over, when the rider said.</summary>
    public string? FailureReason { get; init; }

    public static DeliveryLiveView From(int orderId, Delivery d, DeliveryProgress? progress) => new()
    {
        OrderId = orderId,
        Stage = d.Stage.ToString(),
        Version = d.Version,
        RiderName = d.RiderName ?? d.CourierName,
        RiderPhone = PhoneToRing(d),
        Progress = progress?.Points,
        EtaMinutes = EtaFor(d, progress),
        Nearby = d.NearbyAt != null,
        CustomerComing = d.CustomerComingAt != null,
        FailureReason = d.Stage == DeliveryStage.Failed ? d.FailureReason : null,
    };

    /// <summary>The number the customer may ring: only while someone has the delivery and has not handed it over.</summary>
    public static string? PhoneToRing(Delivery d) =>
        d.Stage is DeliveryStage.Assigned or DeliveryStage.OnTheWay ? d.RiderPhone ?? d.CourierPhone : null;

    /// <summary>Minutes for the card: what is left on the way, the area's in full before, none after.</summary>
    public static int? EtaFor(Delivery d, DeliveryProgress? progress) => d.Stage switch
    {
        DeliveryStage.OnTheWay => progress?.MinutesLeft ?? d.EtaMinutes,
        DeliveryStage.Waiting or DeliveryStage.Assigned => d.EtaMinutes,
        _ => null,
    };
}
