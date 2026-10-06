#nullable enable
using Ninja.EventBus.Events;
namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// The customer's online payment for an order paid ahead came in: Ordering
/// sends the order to the till, or, if it can no longer take the payment,
/// answers with OrderOnlinePaymentRefusedIntegrationEvent and it is given back.
/// </summary>
public record OrderPaidOnlineIntegrationEvent(
    int OrderId,
    Guid PaymentKey,
    decimal Amount,
    DateTime PaidAt) : IntegrationEvent;
