#nullable enable
namespace Ninja.Finance.Domain.AggregatesModel.ProfitAggregate;

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

    /// <summary>
    /// The VAT inside a sale, when the business charges it; not income. On a
    /// refund, the share of the sale's VAT that went back with it.
    /// </summary>
    public decimal Vat { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    /// <summary>
    /// The ticket a sale or a refund is of: how a refund finds the sale whose
    /// VAT it carries a share of. Null on facts from before it was kept.
    /// </summary>
    public int? TicketId { get; private set; }

    protected SalesFact() { }

    public SalesFact(int branchId, DateOnly date, SalesFactKind kind, decimal amount, decimal vat, string reference, int? ticketId = null)
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
        TicketId = ticketId;
    }

    /// <summary>
    /// A refund's VAT is the sale's VAT in proportion: what went back carried
    /// the same share of tax as what was paid. Worked out again whenever the
    /// sale is known, so a refund that arrived before its sale catches up.
    /// </summary>
    public void TakeVatShareOf(SalesFact sale)
    {
        if (Kind != SalesFactKind.Refund || sale.Kind != SalesFactKind.Sale)
            throw new FinanceDomainException("A refund takes its VAT from the sale it gave back.");

        Vat = VatShare(Amount, sale.Amount, sale.Vat);
    }

    /// <summary>The VAT inside <paramref name="amount"/> of a sale that took <paramref name="saleTotal"/> with <paramref name="saleVat"/> in it.</summary>
    public static decimal VatShare(decimal amount, decimal saleTotal, decimal saleVat)
        => saleTotal <= 0 || saleVat <= 0
            ? 0
            : Math.Round(Math.Min(amount, saleTotal) * saleVat / saleTotal, 2, MidpointRounding.AwayFromZero);
}

public enum CostFactKind
{
    Goods = 0,
    Waste = 1,
    /// <summary>
    /// A sale given back (its order cancelled or its bill voided): what it had
    /// cost, taken out of <see cref="Goods"/>. Kept as its own fact so every
    /// amount stays positive and each event keeps its reference.
    /// </summary>
    GoodsReturned = 2,
    /// <summary>
    /// Stock found short at a count, or taken off by hand as a correction:
    /// gone without a sale or a recorded waste, and a cost all the same.
    /// </summary>
    Shrinkage = 3,
    /// <summary>
    /// Stock found over at a count, or put back by hand at its average: an
    /// earlier shortfall or a generous recipe coming back, taken out of
    /// <see cref="Shrinkage"/>. Its own fact so every amount stays positive.
    /// </summary>
    ShrinkageFound = 4,
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

/// <summary>
/// What one payslip's period cost the business, as Payroll last said. One
/// fact per payslip, so a payslip regenerated is still one fact;
/// <see cref="AsOf"/> keeps a message that arrives late from undoing a newer
/// one. A period that runs over a month's end is shared between the months
/// by days (<see cref="ShareOf"/>).
/// </summary>
public class LabourFact : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public int EmployeeId { get; private set; }

    /// <summary>The payslip the figure is for; 0 on a fact from before Payroll named it, kept by employee and period start.</summary>
    public int PayslipId { get; private set; }

    public DateOnly PeriodStart { get; private set; }

    public DateOnly PeriodEnd { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>When Payroll worked the figure out: an older one never replaces a newer.</summary>
    public DateTime AsOf { get; private set; }

    protected LabourFact() { }

    public LabourFact(int branchId, int employeeId, int payslipId, DateOnly periodStart, DateOnly periodEnd, decimal amount, DateTime asOf)
    {
        if (branchId <= 0 || employeeId <= 0)
            throw new FinanceDomainException("A labour fact needs the branch and the employee.");

        EmployeeId = employeeId;
        PayslipId = payslipId;
        PeriodStart = periodStart;
        Apply(branchId, periodEnd, amount, asOf);
    }

    /// <summary>Takes Payroll's figure; answers false, changing nothing, when it is older than the one kept.</summary>
    public bool Set(int branchId, DateOnly periodEnd, decimal amount, DateTime asOf)
    {
        if (asOf < AsOf)
            return false;

        Apply(branchId, periodEnd, amount, asOf);
        return true;
    }

    /// <summary>A fact kept before Payroll named the payslip, claimed by the payslip that now does.</summary>
    public void Adopt(int payslipId)
    {
        if (PayslipId == 0)
            PayslipId = payslipId;
    }

    /// <summary>
    /// The part of the period's cost that falls between <paramref name="from"/>
    /// and <paramref name="to"/> (both days included), by the period's days
    /// inside them: a payslip from 20 March to 19 April is twelve days March's
    /// and nineteen April's.
    /// </summary>
    public decimal ShareOf(DateOnly from, DateOnly to)
    {
        var start = PeriodStart > from ? PeriodStart : from;
        var end = PeriodEnd < to ? PeriodEnd : to;
        if (end < start)
            return 0;

        if (start == PeriodStart && end == PeriodEnd)
            return Amount;

        var days = PeriodEnd.DayNumber - PeriodStart.DayNumber + 1;
        return Math.Round(Amount * (end.DayNumber - start.DayNumber + 1) / days, 2, MidpointRounding.AwayFromZero);
    }

    private void Apply(int branchId, DateOnly periodEnd, decimal amount, DateTime asOf)
    {
        BranchId = branchId;
        PeriodEnd = periodEnd < PeriodStart ? PeriodStart : periodEnd;
        Amount = Math.Max(0, amount);
        AsOf = asOf;
    }
}

/// <summary>
/// When a branch's day starts, as Tenant.API last said in its branch settings
/// event: what the facts are dated by. A branch without a row turns over at
/// <see cref="Services.BusinessDay.DefaultStart"/>.
/// </summary>
public class BranchDayStart : IAggregateRoot
{
    public int BranchId { get; private set; }

    public TimeOnly DayStart { get; private set; }

    /// <summary>The settings event's version (ticks, UTC): an older event arriving late is dropped.</summary>
    public long Version { get; private set; }

    protected BranchDayStart() { }

    public BranchDayStart(int branchId, TimeOnly dayStart, long version)
    {
        BranchId = branchId;
        DayStart = dayStart;
        Version = version;
    }

    /// <summary>Answers false, changing nothing, for a version older than the one kept.</summary>
    public bool Set(TimeOnly dayStart, long version)
    {
        if (version < Version)
            return false;

        DayStart = dayStart;
        Version = version;
        return true;
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

    /// <summary>The sale fact of a ticket, if Finance has heard of it.</summary>
    Task<SalesFact?> FindSaleOfTicketAsync(int ticketId);

    /// <summary>The refunds of a ticket Finance has heard of, to give them their VAT once the sale is known.</summary>
    Task<List<SalesFact>> GetRefundsOfTicketAsync(int ticketId);

    Task<LabourFact?> FindLabourAsync(int payslipId);

    /// <summary>A fact kept before Payroll named the payslip, by employee and period start.</summary>
    Task<LabourFact?> FindUnnamedLabourAsync(int employeeId, DateOnly periodStart);

    Task<BranchDayStart?> FindDayStartAsync(int branchId);

    BranchDayStart Add(BranchDayStart dayStart);
}
