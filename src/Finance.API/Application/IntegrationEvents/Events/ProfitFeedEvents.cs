using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

// Partial views of other services' events — the class names must match
// for routing; only the fields the profit projection reads are declared.

/// <summary>A ticket was paid (Sales).</summary>
public record TicketSettledIntegrationEvent : IntegrationEvent
{
    public int TicketId { get; init; }

    public int BranchId { get; init; }

    public decimal Total { get; init; }

    public decimal Vat { get; init; }

    /// <summary>
    /// When it was paid: an offline till's sale arrives hours later, dated
    /// when the cash changed hands. Default from an older producer, whose
    /// creation time was the settle time.
    /// </summary>
    public DateTime SettledAt { get; init; }

    /// <summary>
    /// The moment the sale happened, for the day it belongs to. A method, not
    /// a property: nothing on the wire carries it (see Ninja.Contracts.Tests).
    /// </summary>
    public DateTime SaleTime() => SettledAt == default ? CreationDate : SettledAt;
}

/// <summary>A credit note was issued against a settled ticket (Sales).</summary>
public record TicketRefundedIntegrationEvent : IntegrationEvent
{
    public int RefundId { get; init; }

    /// <summary>The ticket given back: its sale says how much VAT went back with the refund.</summary>
    public int TicketId { get; init; }

    public int BranchId { get; init; }

    public decimal Amount { get; init; }
}

/// <summary>Stock left the shelf at a cost: a sale's ingredients or waste (Inventory).</summary>
public record StockConsumedIntegrationEvent : IntegrationEvent
{
    public int BranchId { get; init; }

    /// <summary>
    /// "Sale", "Waste", "SaleReversal" (a sale given back: out of the cost of
    /// goods), "Shrinkage" (found short at a count or taken off by hand) or
    /// "ShrinkageFound" (found over, or put back by hand: out of shrinkage).
    /// </summary>
    public string Kind { get; init; } = string.Empty;

    public decimal Cost { get; init; }

    public DateTime At { get; init; }
}

/// <summary>What one payslip's period cost in wages, as of its latest figure (Payroll).</summary>
public record EmployeeEarningsChangedIntegrationEvent : IntegrationEvent
{
    public int BranchId { get; init; }

    public int EmployeeId { get; init; }

    /// <summary>The payslip the figure is for; 0 from a Payroll that did not send it yet.</summary>
    public int PayslipId { get; init; }

    public DateOnly PeriodStart { get; init; }

    public DateOnly PeriodEnd { get; init; }

    public decimal NetEarned { get; init; }

    /// <summary>
    /// What the period cost the business: the pay with its bonuses, less the
    /// deductions. Null from a Payroll that did not send it yet, which only
    /// sent <see cref="NetEarned"/>.
    /// </summary>
    public decimal? LabourCost { get; init; }

    /// <summary>The cost to book: <see cref="LabourCost"/>, or the earnings alone from an older Payroll.</summary>
    public decimal Cost() => LabourCost ?? NetEarned;
}
