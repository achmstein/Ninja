namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// Event used when an order is confirmed by admin (ready for POS)
/// </summary>
public record class OrderStatusChangedToConfirmedDomainEvent(
    int OrderId,
    IEnumerable<OrderItem> OrderItems) : INotification
{
    /// <summary>An offline till's sale sent late: already made and handed over, nobody to tell.</summary>
    public bool Replay { get; init; }
}
