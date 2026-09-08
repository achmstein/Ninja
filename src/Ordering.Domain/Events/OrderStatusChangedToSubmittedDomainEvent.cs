namespace Chillax.Ordering.Domain.Events;

/// <summary>
/// Event used when an order passes the stock check and is ready for staff to
/// confirm - the moment it appears in the pending queue.
/// </summary>
public record class OrderStatusChangedToSubmittedDomainEvent(int OrderId) : INotification;
