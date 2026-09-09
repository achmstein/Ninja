using Chillax.EventBus.Events;

namespace Chillax.Accounts.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the slip Sales issues when a customer pays down their
/// tab at the till (services share no contracts assembly — each declares the
/// fields it reads). The money is already in the drawer or on the terminal;
/// Accounts only lowers what is owed.
/// </summary>
public record TabPaymentRecordedIntegrationEvent(
    int TabPaymentId,
    int Number,
    int BranchId,
    string CustomerId,
    string? CustomerName,
    string Tender,
    decimal Amount,
    string RecordedBy,
    DateTime RecordedAt) : IntegrationEvent;
