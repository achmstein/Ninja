#nullable enable
using Chillax.Sales.API.Application.Queries;
using Chillax.Sales.Infrastructure.Idempotency;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.Commands;

public record PaymentDto(PaymentTender Tender, decimal Amount, string? CustomerId = null, string? CustomerName = null);

public record SettleResult(int ReceiptNumber, decimal Change);

public record SettleTicketCommand(
    int TicketId,
    IReadOnlyCollection<PaymentDto> Payments,
    string SettledBy,
    DateTime? SettledAt = null,
    string? ProvisionalReceiptNumber = null)
    : IRequest<SettleResult>;

public class SettleTicketCommandHandler(
    ITicketRepository ticketRepository,
    Chillax.Sales.Domain.AggregatesModel.ShiftAggregate.IShiftRepository shiftRepository,
    ISalesIntegrationEventService integrationEvents,
    ILogger<SettleTicketCommandHandler> logger) : IRequestHandler<SettleTicketCommand, SettleResult>
{
    /// <summary>
    /// Two cashiers settling in the same instant race on the receipt number;
    /// the unique (branch, number) index rejects the loser, who just retries.
    /// </summary>
    private const int ReceiptNumberAttempts = 3;

    public async Task<SettleResult> Handle(SettleTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        var payments = command.Payments
            .Select(p => new Payment(p.Tender, p.Amount, command.SettledBy, p.CustomerId, p.CustomerName))
            .ToList();

        // Attribute the settle to the branch's open drawer, if one is open —
        // a missing shift never blocks a sale, it just goes unattributed
        var shift = await shiftRepository.FindOpenByBranchAsync(ticket.BranchId);

        // The branch's rules as they stand now, frozen onto the ticket by the
        // settle: this is the last moment they can change the bill
        var rules = await ticketRepository.GetPricingRulesAsync(ticket.BranchId);

        var change = ticket.Settle(payments, command.SettledBy, shift?.Id, rules, command.SettledAt, command.ProvisionalReceiptNumber);

        for (var attempt = 1; ; attempt++)
        {
            var number = await ticketRepository.GetLastReceiptNumberAsync(ticket.BranchId) + 1;
            var receipt = ticketRepository.AddReceipt(new Receipt(number, ticket.BranchId, ticket.Id));

            try
            {
                await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

                logger.LogInformation(
                    "Ticket {TicketId} settled by {SettledBy} - receipt {Branch}/{Number}, total {Total} (service {Service}, VAT {Vat}), change {Change}",
                    ticket.Id, command.SettledBy, ticket.BranchId, number, ticket.Total, ticket.ServiceCharge, ticket.Vat, change);

                // Queued on the same transaction the behavior commits: the
                // charge Accounts posts from this can never outrun, or miss,
                // the settled rows
                await integrationEvents.AddAndSaveEventAsync(new TicketSettledIntegrationEvent(
                    ticket.Id,
                    ticket.BranchId,
                    number,
                    ticket.Total,
                    command.SettledBy,
                    ticket.Lines.Where(l => l.Source == TicketLineSource.SessionTime).Sum(l => l.Total),
                    // Grouped: two account payments for the same person are one
                    // charge on their tab, not two lines to reconcile
                    payments
                        .Where(p => p.Tender == PaymentTender.Account && p.CustomerId is not null)
                        .GroupBy(p => p.CustomerId!)
                        .Select(g => new TicketAccountCharge(
                            g.Key,
                            g.First().CustomerName,
                            g.Sum(p => p.Amount)))
                        .ToList(),
                    ticket.Subtotal,
                    ticket.ServiceCharge,
                    ticket.Vat,
                    ticket.Lines.Where(l => l.OrderId is not null).Select(l => l.OrderId!.Value).Distinct().ToList(),
                    ticket.SessionId,
                    Payment.DescribeTenders(payments),
                    ticket.SettledAt ?? DateTime.UtcNow,
                    ticket.PlaceId));

                return new SettleResult(number, change);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Not a numbering race: somebody else settled or discarded
                // this ticket first. SalesTransaction turns it into the
                // "reload and try again" answer.
                throw;
            }
            catch (DbUpdateException) when (attempt < ReceiptNumberAttempts)
            {
                // The losing receipt must leave the change tracker or the
                // retry would try to insert it again alongside the new one
                ticketRepository.RemoveReceipt(receipt);
            }
        }
    }
}


/// <summary>Idempotent wrapper for <see cref="SettleTicketCommand"/> keyed on the client's request id.</summary>
public class SettleTicketIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ITicketQueries queries, ILogger<IdentifiedCommandHandler<SettleTicketCommand, SettleResult>> logger)
    : IdentifiedCommandHandler<SettleTicketCommand, SettleResult>(mediator, requestManager, logger)
{
    // The receipt the first attempt issued is on the ticket
    protected override async Task<SettleResult> CreateResultForDuplicateRequestAsync(SettleTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await queries.GetTicketAsync(command.TicketId);
        return new SettleResult(ticket?.ReceiptNumber ?? 0, ticket?.ChangeGiven ?? 0);
    }
}
