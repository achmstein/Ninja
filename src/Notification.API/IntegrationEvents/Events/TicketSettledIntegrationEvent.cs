using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a ticket is paid. Only
/// what the customer's phones need: the place the bill was for, so everyone
/// who scanned that table learns the sitting is over (docs/visit-tab.html),
/// the receipt number, and who had a share put on their tab, so their
/// balance reads again. Never the money.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    int? PlaceId = null,
    IReadOnlyCollection<TicketAccountCharge>? AccountCharges = null) : IntegrationEvent;

/// <summary>An account holder whose tab the settle charged; the amount stays with Accounts.</summary>
public record TicketAccountCharge(string CustomerId);
