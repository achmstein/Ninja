using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

// Partial views of other services' events — the class names must match
// for routing; only the fields the profit projection reads are declared.

/// <summary>A ticket was paid (Sales). Its creation time is the settle time.</summary>
public record TicketSettledIntegrationEvent : IntegrationEvent
{
    public int TicketId { get; init; }

    public int BranchId { get; init; }

    public decimal Total { get; init; }

    public decimal Vat { get; init; }
}

/// <summary>A credit note was issued against a settled ticket (Sales).</summary>
public record TicketRefundedIntegrationEvent : IntegrationEvent
{
    public int RefundId { get; init; }

    public int BranchId { get; init; }

    public decimal Amount { get; init; }
}

/// <summary>Stock left the shelf at a cost: a sale's ingredients or waste (Inventory).</summary>
public record StockConsumedIntegrationEvent : IntegrationEvent
{
    public int BranchId { get; init; }

    /// <summary>"Sale" or "Waste".</summary>
    public string Kind { get; init; } = string.Empty;

    public decimal Cost { get; init; }

    public DateTime At { get; init; }
}

/// <summary>What one employee's period cost in wages, as of the latest payslip (Payroll).</summary>
public record EmployeeEarningsChangedIntegrationEvent : IntegrationEvent
{
    public int BranchId { get; init; }

    public int EmployeeId { get; init; }

    public DateOnly PeriodStart { get; init; }

    public DateOnly PeriodEnd { get; init; }

    public decimal NetEarned { get; init; }
}
