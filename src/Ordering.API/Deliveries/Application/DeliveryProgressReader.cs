#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// How far along the deliveries on their way are, read from where their
/// riders' phones last were (<see cref="RiderSpot"/>). A spot from before the
/// delivery left says nothing about it; a customer is never shown less than
/// they were last told. Nothing is known of a courier company's courier.
/// </summary>
public static class DeliveryProgressReader
{
    /// <summary>One delivery's progress; null unless it is on its way.</summary>
    public static async Task<DeliveryProgress?> ForAsync(OrderingContext context, int orderId, Delivery delivery, CancellationToken cancellationToken = default)
    {
        if (delivery.Stage != DeliveryStage.OnTheWay)
            return null;
        // Find, not a query: a spot changed in this same unit of work is read as it now is
        var spot = delivery.RiderUserId is { } rider ? await context.RiderSpots.FindAsync([rider], cancellationToken) : null;
        return Read(spot, orderId, delivery.RiderUserId, delivery.Latitude, delivery.Longitude, delivery.DistanceMeters, delivery.EtaMinutes, delivery.OutAt);
    }

    /// <summary>The progress a delivery has with its rider's spot as it stands.</summary>
    public static DeliveryProgress Read(
        RiderSpot? spot, int orderId, string? riderUserId, double? latitude, double? longitude, int? distanceMeters, int? etaMinutes, DateTime? outAt)
    {
        // A courier company's courier: where they are is the company's to say
        if (riderUserId is null)
            return new(null, etaMinutes is > 0 ? etaMinutes : null, false);
        if (spot is null || outAt is null || spot.At < outAt)
            return DeliveryProgress.AtStart(etaMinutes);

        var progress = DeliveryProgress.Of(latitude, longitude, distanceMeters, etaMinutes, spot.Latitude, spot.Longitude);
        var told = spot.ToldFor(orderId);
        return progress.Points is { } points && points < told ? progress with { Points = told } : progress;
    }
}
