#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when the customer's online
/// payment for an order paid ahead came in. Same type name as the source (the
/// routing key). The order goes to the till; one that can no longer take it
/// answers with OrderOnlinePaymentRefusedIntegrationEvent, and Sales gives
/// the money back.
/// </summary>
public record OrderPaidOnlineIntegrationEvent(
    int OrderId,
    Guid PaymentKey,
    decimal Amount,
    DateTime PaidAt) : IntegrationEvent;
