#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Payments;

/// <summary>
/// A payment waiting on the owner: money the provider would not move, or its records disagreeing with ours.
/// </summary>
/// <param name="Status">Ours: Pending, Paid, Authorized (held), Voided, Refunded, Failed or Expired.</param>
/// <param name="Move">The money still to move (Capture, Void, Refund), or None when it is a disagreement to look into.</param>
/// <param name="Problem">What went wrong, in the provider's words or ours.</param>
/// <param name="NextTryAt">When the move is next tried by itself; null when it waits on the owner alone.</param>
public sealed record PaymentAttentionView(
    Guid Key,
    int? OrderId,
    int? TicketId,
    int BranchId,
    string? PayerName,
    decimal Charged,
    string Currency,
    string Status,
    string Move,
    string? Problem,
    DateTime AttentionSince,
    int Attempts,
    DateTime? NextTryAt,
    string? TransactionId,
    DateTime CreatedAt);

/// <summary>The owner asks for a payment's move to be tried now (one refused, or waiting on its next try).</summary>
public sealed record RetryPaymentMoveCommand(Guid Key) : IRequest<bool>;

public class RetryPaymentMoveCommandHandler(IOnlinePaymentRepository payments, TimeProvider clock) : IRequestHandler<RetryPaymentMoveCommand, bool>
{
    public async Task<bool> Handle(RetryPaymentMoveCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.Key) ?? throw new SalesDomainException("No such payment.");
        payment.RetryMoveNow(clock.GetUtcNow().UtcDateTime);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        return true;
    }
}

/// <summary>The owner has seen to a payment that disagreed with the provider; it leaves their list.</summary>
public sealed record DismissPaymentCommand(Guid Key) : IRequest<bool>;

public class DismissPaymentCommandHandler(IOnlinePaymentRepository payments) : IRequestHandler<DismissPaymentCommand, bool>
{
    public async Task<bool> Handle(DismissPaymentCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.Key) ?? throw new SalesDomainException("No such payment.");
        payment.Dismiss();
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        return true;
    }
}

public static class PaymentAttentionApi
{
    public static void MapPaymentAttention(this RouteGroupBuilder api)
    {
        api.MapGet("/attention", ListAttention)
            .RequireAuthorization("Owner")
            .WithName("ListPaymentsNeedingAttention")
            .WithSummary("Online payments waiting on the owner: money the provider would not move, or its records disagreeing with ours");

        api.MapPost("/{key:guid}/retry", Retry)
            .RequireAuthorization("Owner")
            .WithName("RetryPaymentMove")
            .WithSummary("Try a payment's money move (charge, let go, refund) at the provider now");

        api.MapPost("/{key:guid}/done", MarkDone)
            .RequireAuthorization("Owner")
            .WithName("MarkPaymentMoveDone")
            .WithSummary("The owner made the payment's money move in the provider's dashboard: recorded as made, with what follows from it");

        api.MapPost("/{key:guid}/dismiss", Dismiss)
            .RequireAuthorization("Owner")
            .WithName("DismissPaymentAttention")
            .WithSummary("The owner has seen to a payment that disagreed with the provider; it leaves the list");
    }

    public static async Task<Ok<List<PaymentAttentionView>>> ListAttention([FromServices] SalesContext db, CancellationToken ct)
    {
        var list = await db.OnlinePayments.AsNoTracking()
            .Where(p => p.AttentionSince != null)
            .OrderBy(p => p.AttentionSince)
            .Take(200)
            .ToListAsync(ct);
        return TypedResults.Ok(list.Select(View).ToList());
    }

    public static async Task<Results<Ok<PaymentAttentionView>, BadRequest<ProblemDetails>>> Retry(
        [FromServices] IMediator mediator, [FromServices] PaymentMoves moves, [FromServices] SalesContext db, Guid key, CancellationToken ct)
    {
        try
        {
            await mediator.Send(new RetryPaymentMoveCommand(key), ct);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
        await moves.RunAsync(key, ct);
        return TypedResults.Ok(View(await db.OnlinePayments.AsNoTracking().SingleAsync(p => p.Key == key, ct)));
    }

    public static async Task<Results<NoContent, BadRequest<ProblemDetails>>> MarkDone(
        [FromServices] IMediator mediator, [FromServices] SalesContext db, Guid key, CancellationToken ct)
    {
        var payment = await db.OnlinePayments.AsNoTracking().FirstOrDefaultAsync(p => p.Key == key, ct);
        if (payment is null || payment.Move == PaymentMove.None)
            return TypedResults.BadRequest(new ProblemDetails { Detail = "There is no money still to move on this payment." });
        try
        {
            await mediator.Send(new RecordPaymentMoveCommand(key, payment.Move, MoveRecord.Done, null, false), ct);
            return TypedResults.NoContent();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    public static async Task<Results<NoContent, BadRequest<ProblemDetails>>> Dismiss([FromServices] IMediator mediator, Guid key, CancellationToken ct)
    {
        try
        {
            await mediator.Send(new DismissPaymentCommand(key), ct);
            return TypedResults.NoContent();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails { Detail = ex.Message });
        }
    }

    private static PaymentAttentionView View(OnlinePayment p) => new(
        p.Key, p.OrderId, p.TicketId, p.BranchId, p.PayerName, p.Charged, p.Currency, p.Status.ToString(), p.Move.ToString(),
        p.Problem, p.AttentionSince ?? p.CreatedAt, p.MoveAttempts, p.Move == PaymentMove.None ? null : p.MoveDueAt, p.TransactionId, p.CreatedAt);
}
