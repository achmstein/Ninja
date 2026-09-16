using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when the bill an order sits
/// on was paid, voided or partly refunded. Carried to the customer's own
/// SignalR group so their order list refetches; a pointer, never money.
/// </summary>
public record OrderPaymentChangedIntegrationEvent(
    int OrderId,
    string? BuyerIdentityGuid,
    string? GuestId,
    string Change,
    int? ReceiptNumber,
    int BranchId) : IntegrationEvent;
