using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A customer paid down their tab at the till. The money is already in the
/// drawer (cash) or on the terminal; Accounts posts the payment on the
/// ledger, idempotent on the slip id. Nothing else listens.
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
