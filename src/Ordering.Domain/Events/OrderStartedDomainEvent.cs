
namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// Event used when a cafe order is created
/// </summary>
public record class OrderStartedDomainEvent(
    Order Order,
    string UserId,
    string UserName) : INotification;
