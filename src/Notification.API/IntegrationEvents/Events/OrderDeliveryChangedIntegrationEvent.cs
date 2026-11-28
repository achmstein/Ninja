using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a delivery moved on. The rider hears
/// when it is theirs or no longer, the customer when it leaves, arrives or
/// could not be handed over, and the till's screens every step.
/// </summary>
/// <param name="Stage">Ordering's stage name; read through <see cref="Model.DeliveryStage"/>, an unknown one as Unknown.</param>
/// <param name="Address">The address the rider's push names.</param>
/// <param name="CourierProviderId">The courier company that has it instead of a rider: no rider's phone rings for it.</param>
/// <param name="CourierName">The courier the company sent, when it said: what the customer is told where a rider's name would be.</param>
/// <param name="EtaMinutes">About how many minutes are left; null when unsaid or once it is over.</param>
/// <param name="RiderPhone">The number the customer may ring, only from the delivery being given until it is handed over.</param>
/// <param name="Progress">0 to 100, the share of the way covered, while on the way.</param>
/// <param name="Nearby">The rider has been near the door.</param>
/// <param name="CustomerComing">The customer said they are coming down.</param>
/// <param name="Note">"Nearby" or "CustomerComing" when this is that news and no step of the delivery; null for a step, and from an Ordering older than it.</param>
/// <param name="FailureReason">Why it could not be handed over, when the rider said.</param>
/// <param name="Version">Ordering's count of the delivery's moves: a later move carries a higher one. 0 from an Ordering older than it.</param>
public record OrderDeliveryChangedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Stage,
    string? RiderUserId,
    string? RiderName,
    string? PreviousRiderUserId,
    string? BuyerIdentityGuid,
    string? GuestId,
    bool CashHandedIn,
    decimal Total,
    string? Address,
    int Version = 0,
    int? CourierProviderId = null,
    string? CourierName = null,
    int? EtaMinutes = null,
    string? RiderPhone = null,
    int? Progress = null,
    bool Nearby = false,
    bool CustomerComing = false,
    string? Note = null,
    string? FailureReason = null) : IntegrationEvent;
