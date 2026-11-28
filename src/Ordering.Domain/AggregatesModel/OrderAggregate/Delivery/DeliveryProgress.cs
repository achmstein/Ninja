#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// How far along a delivery on its way is, worked out from where its rider's
/// phone last was: the share of the way covered, about how many minutes are
/// left, and whether the rider is near the door. Straight lines only (see
/// <see cref="Geo"/>): a guide for the customer's card, not a route. The
/// customer is told these, never where the rider is.
/// </summary>
/// <param name="Points">0 to 100: the share of the way from the branch covered. Null when it cannot be said (no pin, or no distance kept).</param>
/// <param name="MinutesLeft">About how long is left, from the area's minutes; null when the area said none.</param>
/// <param name="Near">The rider is within <see cref="DeliveryProgress.NearMeters"/> of the pin.</param>
public readonly record struct DeliveryProgress(int? Points, int? MinutesLeft, bool Near)
{
    /// <summary>Under this, the rider is near the door.</summary>
    public const int NearMeters = 300;

    /// <summary>The customer is told progress again only when it moved this many points.</summary>
    public const int TellEvery = 10;

    /// <summary>Nothing known of the rider yet: the start of the way, the area's minutes in full.</summary>
    public static DeliveryProgress AtStart(int? etaMinutes) => new(0, etaMinutes is > 0 ? etaMinutes : null, false);

    /// <summary>
    /// A delivery's progress with its rider at a point. Without a pin there is nothing to measure to;
    /// without the distance from the branch (an order from before it was kept) only "near" can be said.
    /// </summary>
    /// <param name="distanceMeters">Straight-line from the branch to the pin, as kept when the order was placed.</param>
    public static DeliveryProgress Of(
        double? pinLatitude, double? pinLongitude, int? distanceMeters, int? etaMinutes,
        double riderLatitude, double riderLongitude)
    {
        if (pinLatitude is not { } lat || pinLongitude is not { } lng)
            return new(null, null, false);

        var remaining = Geo.DistanceMeters(riderLatitude, riderLongitude, lat, lng);
        var near = remaining < NearMeters;
        if (distanceMeters is not > 0)
            return new(null, null, near);

        // Further from the door than the branch is (the rider went another way first): the start, not below it
        var left = Math.Clamp((double)remaining / distanceMeters.Value, 0, 1);
        var points = (int)Math.Round((1 - left) * 100);
        int? minutes = etaMinutes is > 0 ? Math.Max(1, (int)Math.Ceiling(etaMinutes.Value * left)) : null;
        return new(points, minutes, near);
    }

    /// <summary>Whether progress moved enough since the customer was last told to tell them again.</summary>
    public static bool WorthTelling(int? points, int lastTold) => points is { } now && now - lastTold >= TellEvery;
}
