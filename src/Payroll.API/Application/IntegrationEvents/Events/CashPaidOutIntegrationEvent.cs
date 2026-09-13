using Chillax.EventBus.Events;

namespace Chillax.Payroll.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when the till hands money to an employee: a wage or an
/// advance. A partial view of Sales' event — the class name must match for
/// routing; only the fields read here are declared.
/// </summary>
public record CashPaidOutIntegrationEvent : IntegrationEvent
{
    public int ShiftId { get; init; }

    public int MovementId { get; init; }

    public int BranchId { get; init; }

    /// <summary>"Wage" or "Advance", as Sales names its <c>CashMovementKind</c>.</summary>
    public string Kind { get; init; } = string.Empty;

    public int EmployeeId { get; init; }

    public decimal Amount { get; init; }

    public string Reason { get; init; } = string.Empty;

    /// <summary>When the shift opened: the business day the money belongs to.</summary>
    public DateTime ShiftOpenedAt { get; init; }

    public DateTime PaidAt { get; init; }

    public string RecordedBy { get; init; } = string.Empty;
}
