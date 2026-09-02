#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// How a branch's menu prices become what the customer pays. Rates are
/// fractions (0.14 is 14%). Service charge applies to what is ordered at a
/// table or in a room — never to a counter sale, never to room time. VAT
/// applies to everything, service included; whether it already sits inside
/// the menu price or goes on top is the branch's call.
/// </summary>
public record PricingRules
{
    /// <summary>Menu prices are what the customer pays: no VAT shown, no service.</summary>
    public static readonly PricingRules None = new(0m, true, 0m);

    public decimal VatRate { get; }

    public bool PricesIncludeVat { get; }

    public decimal ServiceChargeRate { get; }

    public PricingRules(decimal vatRate, bool pricesIncludeVat, decimal serviceChargeRate)
    {
        if (vatRate < 0 || vatRate > 1)
            throw new SalesDomainException("The VAT rate is a fraction between 0 and 1.");

        if (serviceChargeRate < 0 || serviceChargeRate > 1)
            throw new SalesDomainException("The service charge rate is a fraction between 0 and 1.");

        VatRate = vatRate;
        PricesIncludeVat = pricesIncludeVat;
        ServiceChargeRate = serviceChargeRate;
    }
}

/// <summary>
/// What a ticket comes to under a set of rules, rounded to piastres. On a
/// settled ticket these are the frozen figures the receipt was printed with.
/// </summary>
public record Bill(
    decimal Subtotal,
    decimal ServiceCharge,
    decimal Vat,
    decimal Total,
    bool VatIncluded,
    decimal VatRate,
    decimal ServiceChargeRate);
