#nullable enable
namespace Ninja.Sales.API.Application.Commands;

/// <summary>
/// The owner sets how a branch's menu prices become the bill. Rates are
/// fractions. Applies from the next settle on; printed receipts keep theirs.
/// </summary>
public record SetBranchPricingCommand(
    int BranchId,
    decimal VatRate,
    bool PricesIncludeVat,
    decimal ServiceChargeRate,
    decimal MaxCashierDiscountRate,
    string UpdatedBy) : IRequest<bool>;

public class SetBranchPricingCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<SetBranchPricingCommandHandler> logger) : IRequestHandler<SetBranchPricingCommand, bool>
{
    public async Task<bool> Handle(SetBranchPricingCommand command, CancellationToken cancellationToken)
    {
        var rules = new PricingRules(command.VatRate, command.PricesIncludeVat, command.ServiceChargeRate);

        var pricing = await ticketRepository.FindPricingAsync(command.BranchId);

        if (pricing is null)
            ticketRepository.AddPricing(new BranchPricing(command.BranchId, rules, command.MaxCashierDiscountRate, command.UpdatedBy));
        else
            pricing.Set(rules, command.MaxCashierDiscountRate, command.UpdatedBy);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Branch {BranchId} pricing set by {UpdatedBy}: VAT {Vat:P0} ({Inclusive}), service {Service:P0}, cashier discount up to {Cap:P0}",
            command.BranchId, command.UpdatedBy, rules.VatRate, rules.PricesIncludeVat ? "included" : "added", rules.ServiceChargeRate, command.MaxCashierDiscountRate);

        return true;
    }
}
