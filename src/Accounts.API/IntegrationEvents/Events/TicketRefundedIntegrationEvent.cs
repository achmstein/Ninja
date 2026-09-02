using Chillax.EventBus.Events;

namespace Chillax.Accounts.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the credit note Sales issues against a settled ticket
/// (services share no contracts assembly — each declares the fields it
/// reads). Accounts credits the named tab when the money went back that way.
/// </summary>
public record TicketRefundedIntegrationEvent(
    int RefundId,
    int Number,
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Amount,
    string Tender,
    string? CustomerId,
    string? CustomerName,
    string Reason,
    string RefundedBy) : IntegrationEvent;
