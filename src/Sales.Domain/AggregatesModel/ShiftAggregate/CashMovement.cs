#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

/// <summary>
/// Cash moving in or out of the drawer for a reason other than a sale.
/// Always positive; the type says which way it went.
/// </summary>
public class CashMovement : Entity
{
    public CashMovementType Type { get; private set; }

    public decimal Amount { get; private set; }

    public string Reason { get; private set; } = string.Empty;

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    /// <summary>What a pay-out was for; <see cref="CashMovementKind.Other"/> for pay-ins and free-text reasons.</summary>
    public CashMovementKind Kind { get; private set; }

    /// <summary>Payroll's employee id, on wage and advance pay-outs.</summary>
    public int? EmployeeId { get; private set; }

    /// <summary>The employee's name as picked, so the shift report reads without a lookup.</summary>
    public string? EmployeeName { get; private set; }

    /// <summary>Finance's supplier id, on a supplier pay-out; the payment goes on their account.</summary>
    public int? SupplierId { get; private set; }

    public string? SupplierName { get; private set; }

    /// <summary>Finance's partner id, on an owner's drawing (pay-out) or contribution (pay-in).</summary>
    public int? PartnerId { get; private set; }

    public string? PartnerName { get; private set; }

    /// <summary>Finance's expense category, on an expense pay-out.</summary>
    public int? CategoryId { get; private set; }

    public bool IsStaffPayOut => Type == CashMovementType.PayOut && Kind is CashMovementKind.Wage or CashMovementKind.Advance;

    /// <summary>Money Finance accounts for: a supplier paid, an expense, a partner's money either way.</summary>
    public bool IsFinanceMovement =>
        (Kind == CashMovementKind.Supplier && SupplierId is not null)
        || (Kind == CashMovementKind.Expense && CategoryId is not null)
        || (Kind == CashMovementKind.Partner && PartnerId is not null);

    protected CashMovement() { }

    public CashMovement(CashMovementType type, decimal amount, string reason, string recordedBy,
        CashMovementKind kind = CashMovementKind.Other, int? employeeId = null, string? employeeName = null,
        int? supplierId = null, string? supplierName = null, int? partnerId = null, string? partnerName = null, int? categoryId = null)
    {
        if (amount <= 0)
            throw new SalesDomainException("A cash movement must be a positive amount");

        if (string.IsNullOrWhiteSpace(reason))
            throw new SalesDomainException("A cash movement needs a reason — the count at close has to be explainable");

        var staff = kind is CashMovementKind.Wage or CashMovementKind.Advance;

        if (staff && type != CashMovementType.PayOut)
            throw new SalesDomainException("A wage or an advance is money leaving the drawer");

        if (staff && (employeeId is null or <= 0))
            throw new SalesDomainException("A wage or an advance needs the employee it goes to");

        if (kind == CashMovementKind.Expense && type != CashMovementType.PayOut)
            throw new SalesDomainException("An expense is money leaving the drawer");

        if (kind == CashMovementKind.Expense && (categoryId is null or <= 0))
            throw new SalesDomainException("An expense needs its category");

        if (kind == CashMovementKind.Partner && (partnerId is null or <= 0))
            throw new SalesDomainException("A partner's money needs the partner");

        Type = type;
        Amount = amount;
        Reason = reason;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
        Kind = kind;
        EmployeeId = staff ? employeeId : null;
        EmployeeName = staff ? employeeName?.Trim() : null;
        SupplierId = kind == CashMovementKind.Supplier && supplierId > 0 ? supplierId : null;
        SupplierName = SupplierId is null ? null : supplierName?.Trim();
        PartnerId = kind == CashMovementKind.Partner ? partnerId : null;
        PartnerName = PartnerId is null ? null : partnerName?.Trim();
        CategoryId = kind == CashMovementKind.Expense ? categoryId : null;
    }
}
