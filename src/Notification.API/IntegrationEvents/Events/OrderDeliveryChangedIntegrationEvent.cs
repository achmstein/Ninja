using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a delivery moved on. The rider hears
/// when it is theirs or no longer, the customer when it leaves, arrives or
/// could not be handed over, and the till's screens every step.
/// </summary>
/// <param name="Stage">Ordering's stage name; read through <see cref="Model.DeliveryStage"/>, an unknown one as Unknown.</param>
/// <param name="Address">The address the rider's push names.</param>
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
    int Version = 0) : IntegrationEvent;
