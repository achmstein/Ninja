namespace Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

/// <summary>
/// What a pay-out was for. Staff kinds name the employee so Payroll can
/// post the money on their account; the rest are just a reason.
/// </summary>
public enum CashMovementKind
{
    Other = 0,

    /// <summary>Paying a supplier from the drawer.</summary>
    Supplier = 1,

    /// <summary>A daily worker's wage, or a monthly employee's salary, handed over from the drawer.</summary>
    Wage = 2,

    /// <summary>Money given ahead of pay: lunch money at noon, a سلفة mid-month.</summary>
    Advance = 3,

    /// <summary>A bill or a purchase that is neither stock nor staff, under a Finance category.</summary>
    Expense = 4,

    /// <summary>An owner taking money out (a pay-out) or putting it in (a pay-in).</summary>
    Partner = 5,
}
