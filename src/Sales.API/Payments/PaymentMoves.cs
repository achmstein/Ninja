#nullable enable
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.API.Payments;

/// <summary>How a money move went.</summary>
public enum MoveOutcome
{
    /// <summary>Made (or found made already), and recorded.</summary>
    Done,
    /// <summary>Not made yet; it is tried again by itself.</summary>
    Retrying,
    /// <summary>The provider refused it; it waits on the owner (or, asked for by a person, was dropped and they were told).</summary>
    Refused,
    /// <summary>The payment owes no move (made already, or never asked for).</summary>
    NothingToDo,
    /// <summary>Someone else is making it right now.</summary>
    Busy,
}

/// <param name="Problem">What went wrong, for whoever asked: the provider's words where it gave any.</param>
public sealed record MoveResult(MoveOutcome Outcome, string? Problem = null);

/// <summary>
/// Makes the money moves payments owe at their provider (charge a hold, let it go, refund), the one
/// place that does. A move was recorded beforehand, in the save that decided it; here it is leased
/// (so nobody else makes it at the same time), made with no transaction open (a provider call is never
/// inside one: a save that fails after the provider acted would forget that it did), and its outcome
/// recorded in a transaction of its own (<see cref="RecordPaymentMoveCommand"/>). A move that may have
/// happened already (it was tried before, or the provider did not answer, or refused it) is first
/// looked up at the provider, so it is never made twice and a refusal to repeat it is not mistaken for
/// a failure. Each call works in a scope of its own, apart from the caller's.
/// </summary>
public sealed class PaymentMoves(IServiceScopeFactory scopes, TimeProvider clock, ILogger<PaymentMoves> logger)
{
    /// <summary>How long a move is held by whoever makes it; well over a provider call's time-out.</summary>
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(2);

    /// <param name="interactive">
    /// A person is waiting on it (a cashier's refund): a refusal is theirs to hear, and the move is dropped
    /// rather than left for the owner.
    /// </param>
    public async Task<MoveResult> RunAsync(Guid key, CancellationToken ct, bool interactive = false)
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        var payments = services.GetRequiredService<IOnlinePaymentRepository>();
        var now = clock.GetUtcNow().UtcDateTime;

        if (!await payments.LeaseMoveAsync(key, now, now + Lease))
            return new(MoveOutcome.Busy);

        // Read after the lease, so the row is as the lease left it
        var payment = await payments.GetByKeyAsync(key);
        if (payment is null || payment.Move == PaymentMove.None || payment.TransactionId is null)
        {
            await payments.ReleaseMoveAsync(key);
            return new(MoveOutcome.NothingToDo);
        }

        var move = payment.Move;
        var transactionId = payment.TransactionId;
        var provider = services.GetRequiredService<PaymentProviders>().ByName(payment.Provider);
        var account = provider is SimulatedPaymentProvider
            ? PayRules.NoAccount
            : PayRules.Account(await payments.GetSettingsAsync(), services.GetRequiredService<SecretSealer>(), payment.CardHold);
        var mediator = services.GetRequiredService<IMediator>();

        // Tried before, or due for a while (whoever had it may have stopped mid-call): was it made after all?
        if (payment.MoveAttempts > 0 || payment.MoveDueAt < now - Lease)
        {
            var before = await LookupAsync(provider, account, transactionId, key, ct);
            if (Settled(before, move) is { } already)
                return await RecordAsync(mediator, key, move, already, null, retry: false, ct);
        }

        try
        {
            switch (move)
            {
                case PaymentMove.Capture:
                    await provider.CaptureAsync(account, transactionId, payment.Charged, ct);
                    break;
                case PaymentMove.Void:
                    await provider.VoidAsync(account, transactionId, ct);
                    break;
                case PaymentMove.Refund:
                    await provider.RefundAsync(account, transactionId, payment.Charged, ct);
                    break;
            }
        }
        catch (PaymentProviderException ex)
        {
            // No answer, or a refusal: maybe because it is done already (a repeat), or a hold lapsed at the bank
            var after = await LookupAsync(provider, account, transactionId, key, ct);
            if (Settled(after, move) is { } already)
                return await RecordAsync(mediator, key, move, already, null, retry: false, ct);

            logger.LogWarning(ex, "Online payment {Key}: {Provider} did not {Move} it ({Kind})", key, provider.Name, move, ex.Transient ? "may pass" : "refused");
            if (!ex.Transient && interactive)
                return await RecordAsync(mediator, key, move, MoveRecord.Dropped, ex.Message, retry: false, ct);
            return await RecordAsync(mediator, key, move, MoveRecord.Failed, ex.Message, retry: ex.Transient, ct);
        }

        return await RecordAsync(mediator, key, move, MoveRecord.Done, null, retry: false, ct);
    }

    /// <summary>Runs a move and never throws: the retry worker makes it later if this did not.</summary>
    public async Task TryRunAsync(Guid key, CancellationToken ct = default)
    {
        try
        {
            await RunAsync(key, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Online payment {Key}: its money move did not run now; the retry worker makes it", key);
        }
    }

    /// <summary>What the provider's record says of the move: made, a hold that lapsed, or nothing settled (null).</summary>
    internal static MoveRecord? Settled(ProviderTransaction? state, PaymentMove move) => state switch
    {
        null => null,
        { Refunded: true } when move == PaymentMove.Refund => MoveRecord.Done,
        { Voided: true } when move == PaymentMove.Void => MoveRecord.Done,
        // Paymob calls a hold given back before it was charged voided either way
        { Voided: true } when move == PaymentMove.Refund => MoveRecord.Done,
        { Captured: true } when move == PaymentMove.Capture => MoveRecord.Done,
        { Voided: true } when move == PaymentMove.Capture => MoveRecord.Lapsed,
        _ => null,
    };

    private async Task<ProviderTransaction?> LookupAsync(IPaymentProvider provider, ProviderAccount account, string transactionId, Guid key, CancellationToken ct)
    {
        try
        {
            return await provider.LookupAsync(account, transactionId, ct);
        }
        catch (PaymentProviderException ex)
        {
            logger.LogInformation(ex, "Online payment {Key}: {Provider} could not say how it stands", key, provider.Name);
            return null;
        }
    }

    private static async Task<MoveResult> RecordAsync(IMediator mediator, Guid key, PaymentMove move, MoveRecord record, string? problem, bool retry, CancellationToken ct)
    {
        await mediator.Send(new RecordPaymentMoveCommand(key, move, record, problem, retry), ct);
        return record switch
        {
            MoveRecord.Done => new(MoveOutcome.Done),
            MoveRecord.Lapsed => new(MoveOutcome.Refused, RecordPaymentMoveCommandHandler.LapsedProblem),
            _ => new(retry ? MoveOutcome.Retrying : MoveOutcome.Refused, problem),
        };
    }
}

/// <summary>What became of a move, to record.</summary>
public enum MoveRecord
{
    /// <summary>Made.</summary>
    Done,
    /// <summary>A hold to charge that the bank let go first: nothing can be charged.</summary>
    Lapsed,
    /// <summary>Not made; tried again (or left for the owner) as <see cref="RecordPaymentMoveCommand.Retry"/> says.</summary>
    Failed,
    /// <summary>Refused while a person waited on it: dropped, and they were told.</summary>
    Dropped,
}

/// <summary>
/// A move's outcome, recorded with what follows from it, in one transaction: a hold charged settles its
/// bill; a refund on a settled bill gets its credit note; a hold that lapsed leaves the bill to the
/// till and the payment to the owner. A move no longer owed (recorded already) changes nothing.
/// </summary>
public sealed record RecordPaymentMoveCommand(Guid Key, PaymentMove Move, MoveRecord Record, string? Problem, bool Retry) : IRequest<bool>;

public class RecordPaymentMoveCommandHandler(
    IOnlinePaymentRepository payments,
    ITicketRepository tickets,
    IMediator mediator,
    ISalesIntegrationEventService integrationEvents,
    TimeProvider clock,
    ILogger<RecordPaymentMoveCommandHandler> logger) : IRequestHandler<RecordPaymentMoveCommand, bool>
{
    /// <summary>The name a bill settled by a payment ahead is recorded under, beside a cashier's.</summary>
    public const string SettledBy = "online";

    public const string LapsedProblem = "The card hold lapsed at the bank before it was charged, so nothing was taken: the bill is unpaid. Collect it another way.";

    public async Task<bool> Handle(RecordPaymentMoveCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.Key);
        if (payment is null || payment.Move != command.Move)
        {
            logger.LogInformation("Online payment {Key}: its {Move} was recorded already", command.Key, command.Move);
            return false;
        }
        var now = clock.GetUtcNow().UtcDateTime;
        var by = payment.MoveBy ?? GiveBackOrderPaymentsCommandHandler.By;
        var reason = payment.MoveReason;

        switch (command.Record)
        {
            case MoveRecord.Failed:
                payment.MoveFailed(command.Problem ?? "The provider did not do it.", command.Retry, now);
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                if (payment.AttentionSince == now)
                    logger.LogError("Online payment {Key}: its {Move} keeps failing ({Problem}); the owner is told", payment.Key, command.Move, payment.Problem);
                return true;

            case MoveRecord.Dropped:
                payment.DropMove(command.Problem ?? "The provider refused it.");
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                return true;

            case MoveRecord.Lapsed:
                payment.Void("provider", now);
                payment.NeedsAttention(LapsedProblem, now);
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                logger.LogError("Online payment {Key}: the hold lapsed before it was charged; bill {TicketId} is unpaid", payment.Key, payment.TicketId);
                await TellTheFloorAsync(payment.TicketId);
                return true;
        }

        switch (command.Move)
        {
            case PaymentMove.Capture:
                payment.MarkCaptured(now);
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                logger.LogInformation("Online payment {Key}: the hold of {Charged} is charged", payment.Key, payment.Charged);
                await SettleAsync(payment, ct);
                break;

            case PaymentMove.Void:
                payment.Void(by, now);
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                logger.LogInformation("Online payment {Key}: the hold is let go ({Reason})", payment.Key, reason);
                await TellTheFloorAsync(payment.TicketId);
                break;

            case PaymentMove.Refund:
                payment.Refund(by, now);
                await payments.UnitOfWork.SaveEntitiesAsync(ct);
                logger.LogInformation("Online payment {Key}: {Charged} given back ({Reason})", payment.Key, payment.Charged, reason);
                await CreditAsync(payment, reason, ct);
                await TellTheFloorAsync(payment.TicketId);
                break;
        }
        return true;
    }

    /// <summary>The bill it pays settles itself, if all is paid and nothing else still moves; otherwise the till settles it.</summary>
    private async Task SettleAsync(OnlinePayment payment, CancellationToken ct)
    {
        if (payment.TicketId is not { } ticketId || await tickets.GetAsync(ticketId) is not { Status: TicketStatus.Open })
            return;
        try
        {
            if (payment.OrderId is not null)
            {
                // The order's own bill: its payment is its whole tender (SettleTicketCommand folds paid online payments in)
                var settled = await mediator.Send(new SettleTicketCommand(ticketId, [], SettledBy), ct);
                logger.LogInformation("Order {OrderId} paid ahead: bill {TicketId} settled online, receipt {Receipt}", payment.OrderId, ticketId, settled.ReceiptNumber);
            }
            else
            {
                await mediator.Send(new SettlePaidOnlineCommand(ticketId), ct);
            }
        }
        catch (SalesDomainException ex)
        {
            logger.LogWarning(ex, "Bill {TicketId} is paid online but could not settle itself; it stays open for the till", ticketId);
            await TellTheFloorAsync(ticketId);
        }
    }

    /// <summary>An order's payment given back after its bill settled: a credit note against the bill, so the receipt is answered.</summary>
    private async Task CreditAsync(OnlinePayment payment, string? reason, CancellationToken ct)
    {
        if (payment.OrderId is null || payment.TicketId is not { } ticketId || await tickets.GetAsync(ticketId) is not { Status: TicketStatus.Settled } bill)
            return;
        try
        {
            await mediator.Send(new RefundTicketCommand(
                bill.Id,
                bill.Lines.Select(l => new RefundLineDto(l.Id, l.Qty)).ToList(),
                reason ?? "Given back online",
                PaymentTender.Online,
                null,
                null,
                payment.MoveBy ?? GiveBackOrderPaymentsCommandHandler.By), ct);
        }
        catch (SalesDomainException ex)
        {
            logger.LogWarning(ex, "Online payment {Key} was given back, but bill {TicketId} took no credit note", payment.Key, bill.Id);
        }
    }

    /// <summary>The till's floor and the guests' phones refetch the bill.</summary>
    private async Task TellTheFloorAsync(int? ticketId)
    {
        if (ticketId is { } id && await tickets.GetAsync(id) is { } ticket)
            await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(ticket.Id, ticket.BranchId));
    }
}
