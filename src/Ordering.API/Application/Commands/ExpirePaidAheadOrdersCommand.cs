using Microsoft.Extensions.Options;

namespace Ninja.Ordering.API.Application.Commands;

/// <summary>How long the clock gives orders paid ahead online ("PayAhead" in configuration).</summary>
public sealed class PayAheadOptions
{
    /// <summary>
    /// How long the branch has to accept an order once it is paid, before it is cancelled and the
    /// customer's money let go. The till is reminded of it meanwhile (PendingOrderReminderService).
    /// </summary>
    public TimeSpan AcceptWithin { get; set; } = TimeSpan.FromMinutes(10);
}

/// <summary>
/// The clock on orders paid ahead online: one whose time to pay ran out is
/// cancelled (Order.PayAheadWindow), and one paid but not accepted by the
/// branch in time is cancelled too (PayAheadOptions.AcceptWithin), so a
/// customer is never left waiting on money they paid. Each cancellation tells
/// the customer, and Sales lets the payment go (a hold) or gives it back. A
/// command, so each sweep's writes and their events share a transaction.
/// </summary>
[DataContract]
public record ExpirePaidAheadOrdersCommand([property: DataMember] DateTime Now) : IRequest<int>;

public class ExpirePaidAheadOrdersCommandHandler(
    OrderingContext context,
    IOptions<PayAheadOptions> options,
    ILogger<ExpirePaidAheadOrdersCommandHandler> logger) : IRequestHandler<ExpirePaidAheadOrdersCommand, int>
{
    /// <summary>At most this many of each a sweep, so one sweep never holds a long transaction</summary>
    private const int Batch = 100;

    public async Task<int> Handle(ExpirePaidAheadOrdersCommand command, CancellationToken cancellationToken)
    {
        var acceptWithin = options.Value.AcceptWithin;
        var unpaid = await context.Orders
            .Where(o => o.OrderStatus == OrderStatus.AwaitingPayment && o.PaymentDueBy <= command.Now)
            .OrderBy(o => o.PaymentDueBy)
            .Take(Batch)
            .ToListAsync(cancellationToken);
        var acceptBefore = command.Now - acceptWithin;
        var unaccepted = await context.Orders
            .Where(o => o.PaysOnline && o.OrderStatus == OrderStatus.Submitted && o.PaidOnlineAt <= acceptBefore)
            .OrderBy(o => o.PaidOnlineAt)
            .Take(Batch)
            .ToListAsync(cancellationToken);

        var expired = unpaid.Count(o => o.ExpireUnpaid(command.Now));
        var turnedAway = unaccepted.Count(o => o.ExpireUnaccepted(command.Now, acceptWithin));
        if (expired + turnedAway == 0)
        {
            return 0;
        }

        await context.SaveEntitiesAsync(cancellationToken);
        if (expired > 0)
            logger.LogInformation("Cancelled {Count} order(s) paid ahead that were not paid in time", expired);
        if (turnedAway > 0)
            logger.LogWarning("Cancelled {Count} paid order(s) the branch did not accept within {Window}; their payments are let go", turnedAway, acceptWithin);
        return expired + turnedAway;
    }
}
