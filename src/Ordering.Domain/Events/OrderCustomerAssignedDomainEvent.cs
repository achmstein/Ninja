#nullable enable
namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// Event used when a customer is put on an order after it was placed — the
/// till forgot to attach one, or attached the wrong one. Carries the
/// accounts' identities itself: domain events dispatch before the save, so
/// a buyer created in the same command is not yet a row anyone could query,
/// and the one being replaced is only a row id on the order.
/// </summary>
/// <param name="PreviousBuyerIdentityGuid">
/// The account the order left, when it changed hands — whose points Loyalty
/// moves to the new one. Null when it had only a name, or nobody, before.
/// </param>
public record class OrderCustomerAssignedDomainEvent(
    Order Order,
    string? BuyerIdentityGuid,
    string? PreviousBuyerIdentityGuid = null) : INotification;
