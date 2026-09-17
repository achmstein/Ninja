using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a ticket is paid. Only
/// what the customer's phones need: the place the bill was for, so everyone
/// who scanned that table learns the sitting is over (docs/visit-tab.html),
/// and the receipt number the thanks card shows. Never the money.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    int? PlaceId = null) : IntegrationEvent;
