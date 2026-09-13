#nullable enable
namespace Chillax.Finance.Domain.AggregatesModel.ProfitAggregate;

/// <summary>
/// The profit and loss is a projection: what other services told Finance,
/// kept as facts it can sum by month. Sales come from the till, the cost
/// of goods from the storeroom, labour from payroll; expenses are
/// Finance's own. Each fact carries the reference that produced it, so a
/// redelivered event changes nothing.
/// </summary>
public enum SalesFactKind
{
    Sale = 0,
    Refund = 1,
}

public class SalesFact : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public DateOnly Date { get; private set; }

    public SalesFactKind Kind { get; private set; }

    /// <summary>What the customer paid (a sale) or got back (a refund).</summary>
    public decimal Amount { get; private set; }

    /// <summary>The VAT inside a sale, when the café charges it; not income.</summary>
    public decimal Vat { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    protected SalesFact() { }

    public SalesFact(int branchId, DateOnly date, SalesFactKind kind, decimal amount, decimal vat, string reference)
    {
        if (branchId <= 0)
            throw new FinanceDomainException("A sales fact needs the branch.");

        if (amount < 0)
            throw new FinanceDomainException("A sales fact cannot be negative.");

        if (string.IsNullOrWhiteSpace(reference))
            throw new FinanceDomainException("A sales fact needs its reference.");

        BranchId = branchId;
        Date = date;
        Kind = kind;
        Amount = amount;
        Vat = Math.Max(0, vat);
        Reference = reference;
    }
}

public enum CostFactKind
{
    Goods = 0,
    Waste = 1,
}

public class CostFact : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public DateOnly Date { get; private set; }

    public CostFactKind Kind { get; private set; }

    public decimal Amount { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    protected CostFact() { }

    public CostFact(int branchId, DateOnly date, CostFactKind kind, decimal amount, string reference)
    {
        if (branchId <= 0)
            throw new FinanceDomainException("A cost fact needs the branch.");

        if (amount < 0)
            throw new FinanceDomainException("A cost fact cannot be negative.");

        if (string.IsNullOrWhiteSpace(reference))
            throw new FinanceDomainException("A cost fact needs its reference.");

        BranchId = branchId;
        Date = date;
        Kind = kind;
        Amount = amount;
        Reference = reference;
    }
}

/// <summary>What one employee's period cost, as Payroll last said; the latest value for (employee, period) wins.</summary>
public class LabourFact : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public int EmployeeId { get; private set; }

    public DateOnly PeriodStart { get; private set; }

    public DateOnly PeriodEnd { get; private set; }

    public decimal Amount { get; private set; }

    protected LabourFact() { }

    public LabourFact(int branchId, int employeeId, DateOnly periodStart, DateOnly periodEnd, decimal amount)
    {
        if (branchId <= 0 || employeeId <= 0)
            throw new FinanceDomainException("A labour fact needs the branch and the employee.");

        BranchId = branchId;
        EmployeeId = employeeId;
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        Set(branchId, periodEnd, amount);
    }

    public void Set(int branchId, DateOnly periodEnd, decimal amount)
    {
        BranchId = branchId;
        PeriodEnd = periodEnd;
        Amount = Math.Max(0, amount);
    }
}

public interface IProfitRepository
{
    IUnitOfWork UnitOfWork { get; }

    SalesFact Add(SalesFact fact);

    CostFact Add(CostFact fact);

    LabourFact Add(LabourFact fact);

    Task<bool> HasSalesReferenceAsync(string reference);

    Task<bool> HasCostReferenceAsync(string reference);

    Task<LabourFact?> FindLabourAsync(int employeeId, DateOnly periodStart);
}
