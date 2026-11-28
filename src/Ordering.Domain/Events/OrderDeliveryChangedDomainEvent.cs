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
    bool CourierCollected = false,
    DeliveryNote Note = DeliveryNote.None) : INotification;

/// <summary>
/// What a delivery's change is about, when it is not one of its steps. Such a
/// change is told, and leaves no row in the delivery's history.
/// </summary>
public enum DeliveryNote
{
    /// <summary>A step: given, out, delivered, failed, brought back, cash in.</summary>
    None = 0,

    /// <summary>The rider's phone came near the door.</summary>
    Nearby = 1,

    /// <summary>The customer said they are coming down.</summary>
    CustomerComing = 2,
}
