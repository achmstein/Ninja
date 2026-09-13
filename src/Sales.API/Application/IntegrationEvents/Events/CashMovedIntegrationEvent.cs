using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// The drawer moved money for something Finance accounts for: a supplier
/// paid (their account), an expense (the register), a partner taking or
/// putting in money (their account). Keyed on shift and movement so a
/// redelivery never posts twice; the shift's opening time is the business
/// day the money belongs to.
/// </summary>
public record CashMovedIntegrationEvent(
    int ShiftId,
    int MovementId,
    int BranchId,
    string Type,
    string Kind,
    decimal Amount,
    string Reason,
    int? SupplierId,
    int? PartnerId,
    int? CategoryId,
    DateTime ShiftOpenedAt,
    DateTime RecordedAt,
    string RecordedBy) : IntegrationEvent;
