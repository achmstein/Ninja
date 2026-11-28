using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a delivery on its way got noticeably
/// closer (ten points or more of the way since the customer was last told).
/// Only the customer's card and their open app move for it.
/// </summary>
/// <param name="Progress">0 to 100: the share of the way covered.</param>
/// <param name="EtaMinutes">About how many minutes are left; null when unsaid.</param>
/// <param name="Version">The delivery's count of steps when the rider reported.</param>
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
