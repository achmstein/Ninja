#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// An online payment the order could not take: it came after the order
/// stopped waiting (cancelled unpaid), the order was paid already, or it is
/// for another amount. Sales gives it back to the customer.
/// </summary>
/// <param name="Reason">The rule's code (payment.too_late, payment.paid_already, payment.amount_mismatch).</param>
public record OrderOnlinePaymentRefusedIntegrationEvent(
    int OrderId,
    Guid PaymentKey,
    string Reason) : IntegrationEvent;
