using Ninja.EventBus.Events;

namespace Ninja.Accounts.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a POS ticket settles.
/// Accounts only cares about the parts paid on a tab — a shared bill can
/// charge several people, so it is a list.
/// </summary>
public record TicketSettledIntegrationEvent(
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Total,
    string? SettledBy = null,
    decimal TimeTotal = 0,
    IReadOnlyCollection<TicketAccountCharge>? AccountCharges = null) : IntegrationEvent;

/// <summary>What one account holder's share of a settled ticket came to.</summary>
public record TicketAccountCharge(string CustomerId, string? CustomerName, decimal Amount);
