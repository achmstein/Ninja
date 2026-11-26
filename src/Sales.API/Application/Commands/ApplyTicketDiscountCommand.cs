#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;

namespace Ninja.Sales.API.Application.Commands;

/// <summary>
/// Money off the whole bill: one of <paramref name="Rate"/> (a fraction) or
/// <paramref name="Amount"/>. <paramref name="Uncapped"/> is true for an
/// owner; anyone else is held to the branch's cashier cap.
/// </summary>
public record ApplyTicketDiscountCommand(
    int TicketId,
    decimal? Rate,
    decimal? Amount,
    string? Reason,
    string By,
    bool Uncapped) : IRequest<bool>;

public class ApplyTicketDiscountCommandHandler(
    ITicketRepository ticketRepository,
    Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate.IPartPaymentRepository partPayments,
    ILogger<ApplyTicketDiscountCommandHandler> logger) : IRequestHandler<ApplyTicketDiscountCommand, bool>
{
    public async Task<bool> Handle(ApplyTicketDiscountCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        // The cap is the branch's own setting, read now: the owner may have
        // just raised it for tonight
        decimal? cap = command.Uncapped
            ? null
            : (await ticketRepository.FindPricingAsync(ticket.BranchId))?.MaxCashierDiscountRate
              ?? BranchPricing.DefaultMaxCashierDiscountRate;

        ticket.ApplyDiscount(command.Rate, command.Amount, command.Reason, command.By, cap);

        // Money already taken on the bill is a floor under it: a discount
        // that goes below it would have the till owing the customer
        var partPaid = Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate.PartPaid.Of(await partPayments.ListActiveForTicketAsync(ticket.Id)).Amount;
        if (partPaid > 0 && ticket.GetBill(await ticketRepository.GetPricingRulesAsync(ticket.BranchId)).Total < partPaid)
            throw new SalesDomainException($"That discount takes the bill below what was already paid on it ({partPaid:0.00}).");

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Ticket {TicketId} discounted by {By}: {Rate} / {Amount} — {Reason}",
            ticket.Id, command.By, command.Rate, command.Amount, command.Reason);

        return true;
    }
}

/// <summary>Idempotent wrapper for <see cref="ApplyTicketDiscountCommand"/> keyed on the client's request id.</summary>
public class ApplyTicketDiscountIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<ApplyTicketDiscountCommand, bool>> logger)
    : IdentifiedCommandHandler<ApplyTicketDiscountCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(ApplyTicketDiscountCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}

public record RemoveTicketDiscountCommand(int TicketId) : IRequest<bool>;

public class RemoveTicketDiscountCommandHandler(ITicketRepository ticketRepository) : IRequestHandler<RemoveTicketDiscountCommand, bool>
{
    public async Task<bool> Handle(RemoveTicketDiscountCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.RemoveDiscount();

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return true;
    }
}
