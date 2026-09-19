namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// Event used when an order is confirmed by admin (ready for POS)
/// </summary>
public record class OrderStatusChangedToConfirmedDomainEvent(
    int OrderId,
    IEnumerable<OrderItem> OrderItems) : INotification;
