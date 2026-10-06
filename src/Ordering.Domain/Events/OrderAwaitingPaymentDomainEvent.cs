namespace Ninja.Ordering.Domain.Events;

/// <summary>
/// An order paid ahead online passed its check and is priced: it now waits
/// for the customer's payment, unseen by the till, until <c>PaymentDueBy</c>.
/// </summary>
public record class OrderAwaitingPaymentDomainEvent(Order Order) : INotification;
