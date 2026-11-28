#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// A delivery on its way got noticeably closer: its rider's phone reported
/// in, and the share of the way covered moved by ten points or more since
/// the customer was last told. Not a step of the delivery (nothing on the
/// order changed), so it is its own event: Notification.API moves the
/// customer's card, and nobody else listens. Carries no point on the map.
/// </summary>
/// <param name="Progress">0 to 100: the share of the way from the branch covered.</param>
/// <param name="EtaMinutes">About how many minutes are left; null when the area said none.</param>
/// <param name="Version">The delivery's count of steps when the rider reported: a card that has seen a later step ignores this.</param>
public record DeliveryProgressedIntegrationEvent(
    int OrderId,
    int BranchId,
    string? BuyerIdentityGuid,
    string? GuestId,
    int Progress,
    int? EtaMinutes,
    string? RiderName,
    string? RiderPhone,
    int Version) : IntegrationEvent;
