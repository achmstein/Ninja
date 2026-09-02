using Chillax.EventBus.Events;

namespace Chillax.Accounts.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a POS ticket settles.
/// Accounts only cares about the part paid on the customer's tab.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Total,
    string? CustomerId,
    string? CustomerName,
    decimal AccountAmount,
    string? SettledBy) : IntegrationEvent;
