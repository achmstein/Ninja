#nullable enable
namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// A delivery moved on: given to a rider or a courier company (or taken from
/// one), out of the door, delivered, its cash handed in or the courier's
/// collection said. The rider, the customer and the till each hear of it;
/// <paramref name="PreviousRiderUserId"/> is the rider who no longer has it,
/// when it changed hands; <paramref name="CourierCollected"/> says the courier
/// company reported what it collected, which settles the bill to it.
/// </summary>
public record class OrderDeliveryChangedDomainEvent(
    Order Order,
    DeliveryStage Stage,
    string? PreviousRiderUserId = null,
    bool CashHandedIn = false,
    bool CourierCollected = false) : INotification;
