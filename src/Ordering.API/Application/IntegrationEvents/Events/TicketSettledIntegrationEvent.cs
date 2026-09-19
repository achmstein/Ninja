#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a ticket is paid. Same
/// type name as the source (the routing key), only the properties Ordering
/// reads: which orders the receipt covered and how it was paid, so each
/// order can say "Paid · receipt #N" to the customer who placed it.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    IReadOnlyCollection<int>? OrderIds = null,
    string? Tender = null,
    DateTime SettledAt = default) : IntegrationEvent;
