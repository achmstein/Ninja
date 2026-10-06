#nullable enable
using Ninja.EventBus.Events;
namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when an order could not take
/// an online payment (it stopped waiting, was paid already, or the amount is
/// not its total): the payment is given back to the customer.
/// </summary>
public record OrderOnlinePaymentRefusedIntegrationEvent(
    int OrderId,
    Guid PaymentKey,
    string Reason) : IntegrationEvent;
