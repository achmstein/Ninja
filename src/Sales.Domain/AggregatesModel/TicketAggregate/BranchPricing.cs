#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// A branch's pricing rules, owned by Sales because Sales owns the money:
/// the rates a receipt is computed with must not depend on another service
/// answering at settle time. Absent a row, a branch prices at
/// <see cref="PricingRules.None"/> — menu prices are the bill.
/// </summary>
public class BranchPricing : IAggregateRoot
{
    public int BranchId { get; private set; }

    public decimal VatRate { get; private set; }

    public bool PricesIncludeVat { get; private set; }

    public decimal ServiceChargeRate { get; private set; }

    /// <summary>
    /// How much of a bill a cashier may take off on their own, as a fraction;
    /// beyond it the discount needs an owner. A branch that never set one
    /// gets <see cref="DefaultMaxCashierDiscountRate"/>.
    /// </summary>
    public decimal MaxCashierDiscountRate { get; private set; } = DefaultMaxCashierDiscountRate;

    public const decimal DefaultMaxCashierDiscountRate = 0.10m;

    public DateTime UpdatedAt { get; private set; }

    public string UpdatedBy { get; private set; } = string.Empty;

    public PricingRules Rules => new(VatRate, PricesIncludeVat, ServiceChargeRate);

    protected BranchPricing() { }

    public BranchPricing(int branchId, PricingRules rules, decimal maxCashierDiscountRate, string updatedBy)
    {
        BranchId = branchId;
        Set(rules, maxCashierDiscountRate, updatedBy);
    }

    /// <summary>
    /// Applies to tickets settled from now on. Settled tickets keep the
    /// figures they were printed with — a rate change never moves a receipt.
    /// </summary>
    public void Set(PricingRules rules, decimal maxCashierDiscountRate, string updatedBy)
    {
        if (maxCashierDiscountRate < 0 || maxCashierDiscountRate > 1)
            throw new SalesDomainException("The cashier discount cap is a fraction between 0 and 1.");

        VatRate = rules.VatRate;
        PricesIncludeVat = rules.PricesIncludeVat;
        ServiceChargeRate = rules.ServiceChargeRate;
        MaxCashierDiscountRate = maxCashierDiscountRate;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
