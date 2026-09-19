using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when the till moves money for something Finance accounts for:
/// a supplier paid, an expense, a partner taking or putting in money. A
/// partial view of Sales' event — the class name must match for routing;
/// only the fields read here are declared.
/// </summary>
public record CashMovedIntegrationEvent : IntegrationEvent
{
    public int ShiftId { get; init; }

    public int MovementId { get; init; }

    public int BranchId { get; init; }

    /// <summary>"PayIn" or "PayOut".</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>"Supplier", "Expense", "Partner" or "Other", as Sales names its <c>CashMovementKind</c>.</summary>
    public string Kind { get; init; } = string.Empty;

    public decimal Amount { get; init; }

    public string Reason { get; init; } = string.Empty;

    public int? SupplierId { get; init; }

    public int? PartnerId { get; init; }

    public int? CategoryId { get; init; }

    /// <summary>When the shift opened: the business day the money belongs to.</summary>
    public DateTime ShiftOpenedAt { get; init; }

    public string RecordedBy { get; init; } = string.Empty;
}
