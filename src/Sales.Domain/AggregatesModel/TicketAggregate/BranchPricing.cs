#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

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

    public DateTime UpdatedAt { get; private set; }

    public string UpdatedBy { get; private set; } = string.Empty;

    public PricingRules Rules => new(VatRate, PricesIncludeVat, ServiceChargeRate);

    protected BranchPricing() { }

    public BranchPricing(int branchId, PricingRules rules, string updatedBy)
    {
        BranchId = branchId;
        Set(rules, updatedBy);
    }

    /// <summary>
    /// Applies to tickets settled from now on. Settled tickets keep the
    /// figures they were printed with — a rate change never moves a receipt.
    /// </summary>
    public void Set(PricingRules rules, string updatedBy)
    {
        VatRate = rules.VatRate;
        PricesIncludeVat = rules.PricesIncludeVat;
        ServiceChargeRate = rules.ServiceChargeRate;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
