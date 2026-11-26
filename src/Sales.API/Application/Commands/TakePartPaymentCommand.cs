#nullable enable
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Infrastructure.Idempotency;

namespace Ninja.Sales.API.Application.Commands;

public record PartPaymentDto(PaymentTender Tender, decimal Amount);

/// <param name="PartPaymentIds">The rows this request made (or gave back); empty when a repeated request is answered from what stands.</param>
/// <param name="Paid">Every part payment the bill counts now.</param>
/// <param name="Remaining">What is left to pay: the total less the part payments and what guests paid or are paying online.</param>
public record PartPaymentResult(IReadOnlyList<int> PartPaymentIds, decimal Paid, decimal Remaining);

/// <summary>
/// Take money for part of an open bill: one of a group pays for what they had
/// (<paramref name="LineIds"/>), or an amount on account. The bill stays open
/// with less left to pay; settling it later brings only the rest. The money is
/// the shift's that took it, as a tab payment's is.
/// </summary>
public record TakePartPaymentCommand(
    int TicketId,
    IReadOnlyCollection<PartPaymentDto> Payments,
    string? PayerName,
    IReadOnlyCollection<int>? LineIds,
    string TakenBy,
    int? ShiftId = null) : IRequest<PartPaymentResult>;

public class TakePartPaymentCommandHandler(
    ITicketRepository tickets,
    IPartPaymentRepository partPayments,
    IOnlinePaymentRepository onlinePayments,
    IShiftRepository shifts,
    TimeProvider clock,
    ILogger<TakePartPaymentCommandHandler> logger) : IRequestHandler<TakePartPaymentCommand, PartPaymentResult>
{
    public async Task<PartPaymentResult> Handle(TakePartPaymentCommand command, CancellationToken cancellationToken)
    {
        // The bill is held while what is left is worked out, so two tills
        // taking money on it take turns: the second sees the first's payment
        await onlinePayments.LockTicketAsync(command.TicketId);

        var ticket = await tickets.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        if (ticket.Status != TicketStatus.Open)
            throw new SalesDomainException("This bill is already closed.");
        if (ticket.Lines.Count == 0)
            throw new SalesDomainException("There is nothing on this bill yet.");
        // A platform pays its own orders, and a delivery is the rider's to collect: neither is the till's to take in parts
        if (ticket.Platform is not null)
            throw new SalesDomainException("This bill is paid by the delivery platform.");
        if (ticket.CollectsAtDoor)
            throw new SalesDomainException("This delivery is paid to the rider at the door.");

        var now = clock.GetUtcNow().UtcDateTime;
        var online = await onlinePayments.ListForTicketAsync(ticket.Id);
        if (online.Any(p => p.Status == OnlinePaymentStatus.Pending && p.Holds(now)))
            throw new SalesDomainException("A guest is paying this bill online right now. Wait a moment and try again.");

        var already = PartPaid.Of(await partPayments.ListActiveForTicketAsync(ticket.Id));

        var wanted = (command.LineIds ?? []).Distinct().ToList();
        if (wanted.Count > 0)
        {
            var lines = ticket.Lines.Where(l => wanted.Contains(l.Id)).ToList();
            if (lines.Count != wanted.Count)
                throw new SalesDomainException("Some of those items are not on this bill.");
            if (lines.Any(l => l.Source == TicketLineSource.SessionTime))
                throw new SalesDomainException("Room time is paid with the bill, not on its own.");
            var claimed = OnlineShares.ClaimedLines(online, now, already);
            if (wanted.Any(claimed.Contains))
                throw new SalesDomainException("Some of those items are already paid for, or being paid by someone else.");
        }

        if (command.Payments.Count == 0)
            throw new SalesDomainException("Enter an amount to take.");

        var bill = ticket.GetBill(await tickets.GetPricingRulesAsync(ticket.BranchId));
        var left = OnlineShares.Money(bill.Total - already.Amount - OnlineShares.Taken(online, now));
        if (left <= 0)
            throw new SalesDomainException("This bill is already paid.");

        // Whatever the tender, the money belongs to the shift on duty: cash
        // raises its drawer, card and InstaPay reconcile against the terminal.
        // Held against a close summing the shift meanwhile.
        var shiftId = await ShiftAttribution.NowAsync(shifts, ticket.BranchId, command.ShiftId);

        // Several tenders are one payment by one person: the items go on the
        // first row only, so a line is never counted as paid twice
        var taken = command.Payments
            .Select((p, i) => PartPayment.Take(
                ticket.Id, ticket.BranchId, shiftId, p.Tender, p.Amount, command.PayerName,
                i == 0 ? wanted : null, command.TakenBy, now))
            .ToList();

        var taking = taken.Sum(p => p.Amount);
        if (taking >= left)
            throw new SalesDomainException("That pays the bill in full: settle it instead.");

        foreach (var payment in taken)
            partPayments.Add(payment);

        // The tills refetch the bill; and a settle, void or move that read it
        // before this is told to reload
        ticket.NotePartPayment();

        await partPayments.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Part payment of {Amount} taken on ticket {TicketId} by {TakenBy} ({Tenders}; shift {ShiftId}); {Remaining} left",
            taking, ticket.Id, command.TakenBy, string.Join("+", taken.Select(p => p.Tender)), shiftId, left - taking);

        return new PartPaymentResult(taken.Select(p => p.Id).ToList(), already.Amount + taking, left - taking);
    }
}

/// <summary>The shift that money taken (or handed back) right now belongs to.</summary>
internal static class ShiftAttribution
{
    /// <summary>
    /// The shift the till names when it is this branch's and open now,
    /// otherwise the branch's open shift; null when none is open. Held until
    /// the transaction ends, the way a settle holds its shift.
    /// </summary>
    public static async Task<int?> NowAsync(IShiftRepository shifts, int branchId, int? named)
    {
        if (named is { } id
            && await shifts.HoldForAttributionAsync(id) is { } shift
            && shift.BranchId == branchId
            && shift.Status == ShiftStatus.Open)
        {
            return shift.Id;
        }

        return await shifts.HoldOpenForAttributionAsync(branchId);
    }
}

/// <summary>What stands on a part-paid bill, for every command that must respect it.</summary>
public static class PartPaymentRules
{
    public const string GiveBackFirst = "Give the part payments back first.";

    /// <summary>What a bill's part payments come to and what is left of it, as it stands.</summary>
    public static async Task<PartPaymentResult> StandingAsync(
        int ticketId, ITicketRepository tickets, IPartPaymentRepository partPayments, IOnlinePaymentRepository onlinePayments, DateTime now)
    {
        var paid = PartPaid.Of(await partPayments.ListActiveForTicketAsync(ticketId)).Amount;
        var ticket = await tickets.GetAsync(ticketId);
        if (ticket is null) return new PartPaymentResult([], paid, 0m);

        var bill = ticket.GetBill(await tickets.GetPricingRulesAsync(ticket.BranchId));
        var online = await onlinePayments.ListForTicketAsync(ticketId);
        return new PartPaymentResult([], paid, Math.Max(0m, OnlineShares.Money(bill.Total - paid - OnlineShares.Taken(online, now))));
    }
}

/// <summary>Idempotent wrapper for <see cref="TakePartPaymentCommand"/> keyed on the client's request id.</summary>
public class TakePartPaymentIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ITicketRepository tickets,
    IPartPaymentRepository partPayments,
    IOnlinePaymentRepository onlinePayments,
    TimeProvider clock,
    ILogger<IdentifiedCommandHandler<TakePartPaymentCommand, PartPaymentResult>> logger)
    : IdentifiedCommandHandler<TakePartPaymentCommand, PartPaymentResult>(mediator, requestManager, logger)
{
    // The first attempt took the money; the bill says what stands now
    protected override Task<PartPaymentResult> CreateResultForDuplicateRequestAsync(TakePartPaymentCommand command, CancellationToken cancellationToken)
        => PartPaymentRules.StandingAsync(command.TicketId, tickets, partPayments, onlinePayments, clock.GetUtcNow().UtcDateTime);
}
