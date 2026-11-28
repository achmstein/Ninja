#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>Where the rider's phone is, sent every few seconds while they have a delivery out.</summary>
public record ReportRiderLocationCommand(string RiderUserId, double Latitude, double Longitude, double? AccuracyMeters = null)
    : IRequest<RiderLocationResult>;

/// <summary>
/// Keeps the rider's last spot and tells each customer whose delivery they
/// have out what came of it: progress when it moved ten points or more, and
/// "almost there" the first time the rider is near the door. The spot goes
/// to its own table; an order is written only when near is first reached,
/// so a report every 20 seconds never collides with the till editing the
/// order. With nothing out, nothing is kept: the app is told to stop.
/// </summary>
public class ReportRiderLocationCommandHandler(
    OrderingContext context,
    IOrderRepository orderRepository,
    IOrderingIntegrationEventService integrationEvents,
    ILogger<ReportRiderLocationCommandHandler> logger) : IRequestHandler<ReportRiderLocationCommand, RiderLocationResult>
{
    /// <summary>A fix further out than this would move the customer's card about for nothing: passed over.</summary>
    public const double MaxAccuracyMeters = 150;

    public async Task<RiderLocationResult> Handle(ReportRiderLocationCommand command, CancellationToken cancellationToken)
    {
        if (command.Latitude is < -90 or > 90 || command.Longitude is < -180 or > 180
            || double.IsNaN(command.Latitude) || double.IsNaN(command.Longitude))
            throw new OrderingDomainException("That isn't a point on the map.", DeliveryErrors.PinInvalid);

        var outNow = await context.Orders.AsNoTracking()
            .Where(o => o.Delivery != null
                && o.OrderStatus == OrderStatus.Confirmed
                && o.VoidedAt == null
                && o.Delivery.RiderUserId == command.RiderUserId
                && o.Delivery.OutAt != null
                && o.Delivery.DeliveredAt == null
                && o.Delivery.FailedAt == null
                && o.Delivery.ReturnedAt == null)
            .Select(o => new
            {
                o.Id,
                o.BranchId,
                o.GuestId,
                BuyerIdentityGuid = o.Buyer != null ? o.Buyer.IdentityGuid : null,
                o.Delivery!.Latitude,
                o.Delivery.Longitude,
                o.Delivery.DistanceMeters,
                o.Delivery.EtaMinutes,
                o.Delivery.NearbyAt,
                o.Delivery.RiderName,
                o.Delivery.RiderPhone,
                o.Delivery.Version,
            })
            .ToListAsync(cancellationToken);

        if (outNow.Count == 0 || command.AccuracyMeters is > MaxAccuracyMeters)
            return new RiderLocationResult(outNow.Count);

        var spot = await context.RiderSpots.FindAsync([command.RiderUserId], cancellationToken);
        if (spot is null)
        {
            spot = new RiderSpot { RiderUserId = command.RiderUserId };
            context.RiderSpots.Add(spot);
        }
        spot.Latitude = command.Latitude;
        spot.Longitude = command.Longitude;
        spot.At = DateTime.UtcNow;

        var told = new Dictionary<int, int>();
        var cameNear = false;
        foreach (var delivery in outNow)
        {
            var progress = DeliveryProgress.Of(
                delivery.Latitude, delivery.Longitude, delivery.DistanceMeters, delivery.EtaMinutes, command.Latitude, command.Longitude);

            if (progress.Near && delivery.NearbyAt is null)
            {
                // The one time a report writes the order: the step's own event tells the customer, progress with it
                var order = await orderRepository.GetAsync(delivery.Id);
                if (order is not null && order.MarkDeliveryNearby())
                {
                    cameNear = true;
                    if (progress.Points is { } nearPoints) told[delivery.Id] = nearPoints;
                    continue;
                }
            }

            if (DeliveryProgress.WorthTelling(progress.Points, spot.ToldFor(delivery.Id)))
            {
                told[delivery.Id] = progress.Points!.Value;
                await integrationEvents.AddAndSaveEventAsync(new DeliveryProgressedIntegrationEvent(
                    delivery.Id, delivery.BranchId, delivery.BuyerIdentityGuid, delivery.GuestId,
                    progress.Points.Value, progress.MinutesLeft, delivery.RiderName, delivery.RiderPhone, delivery.Version));
            }
        }

        spot.Tell(told, outNow.Select(o => o.Id).ToHashSet());

        // Ids and counts only: where a rider is stays out of the logs
        if (told.Count > 0)
            logger.LogInformation("Rider {Rider}: progress told for {Count} deliveries ({OrderIds}), near {Near}",
                command.RiderUserId, told.Count, string.Join(",", told.Keys), cameNear);

        if (cameNear)
            await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        else
            await context.SaveChangesAsync(cancellationToken);

        return new RiderLocationResult(outNow.Count);
    }
}
