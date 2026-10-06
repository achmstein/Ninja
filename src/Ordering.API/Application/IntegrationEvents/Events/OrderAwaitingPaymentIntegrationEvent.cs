#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// An order paid ahead online is checked and priced, and waits for the
/// customer's payment: Sales takes it (for exactly <see cref="Total"/>, from
/// whoever placed it) until <see cref="DueBy"/>, and answers with
/// OrderPaidOnlineIntegrationEvent. The till sees nothing of it until then.
/// </summary>
/// <param name="BuyerIdentityGuid">The signed-in customer who placed it; null for a guest.</param>
/// <param name="GuestId">The guest's device, when a guest placed it.</param>
/// <param name="BuyerName">The name the payment goes out under (the provider's billing name).</param>
/// <param name="Phone">A phone for the provider's checkout, when the order carries one.</param>
/// <param name="IsDelivery">Brought to a door; otherwise the customer collects it.</param>
public record OrderAwaitingPaymentIntegrationEvent(
    int OrderId,
    int BranchId,
    decimal Total,
    string? BuyerIdentityGuid,
    string? GuestId,
    string BuyerName,
    string? Phone,
    bool IsDelivery,
    DateTime DueBy) : IntegrationEvent;
