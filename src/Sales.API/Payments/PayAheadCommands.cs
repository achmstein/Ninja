#nullable enable
using Microsoft.Extensions.Options;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Payments;

// Orders paid ahead online (docs/online-payments-plan.md, "Paying ahead"): the customer pays a delivery
// or an order they collect in the app, before the business sees it. Ordering holds the order until
// the payment comes; Sales takes it against the order (there is no bill yet), and puts it on the
// order's own bill, which it settles, once the till confirms the order.

/// <summary>
/// Ordering priced an order paid ahead and waits for its payment: what to
/// take, from whom, by when. Idempotent: a redelivered event finds its row.
/// </summary>
public sealed record RecordOrderPaymentDueCommand(
    int OrderId, int BranchId, decimal Amount, string? PayerUserId, string? PayerGuestId,
    string PayerName, string? Phone, bool IsDelivery, DateTime DueBy) : IRequest<bool>;

public class RecordOrderPaymentDueCommandHandler(SalesContext context, TimeProvider clock)
    : IRequestHandler<RecordOrderPaymentDueCommand, bool>
{
    public async Task<bool> Handle(RecordOrderPaymentDueCommand command, CancellationToken ct)
    {
        if (await context.OrderPaymentsDue.FindAsync([command.OrderId], ct) is not null)
            return false;
        context.OrderPaymentsDue.Add(new OrderPaymentDue
        {
            OrderId = command.OrderId,
            BranchId = command.BranchId,
            Amount = OnlineShares.Money(command.Amount),
            PayerUserId = command.PayerUserId,
            PayerGuestId = command.PayerGuestId,
            PayerName = command.PayerName,
            Phone = command.Phone,
            IsDelivery = command.IsDelivery,
            DueBy = command.DueBy,
            Status = OrderPaymentDueStatus.Due,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        });
        await context.SaveChangesAsync(ct);
        return true;
    }
}

/// <summary>
/// The customer starts paying an order ahead: the whole of it, through the
/// business's provider. Only whoever placed it, only while it waits for its
/// payment. The order's row is locked meanwhile, so one order never has two
/// checkouts open: one started again (a closed browser, a retry) lets the
/// earlier go; if that one is paid after all, the order refuses the second
/// payment and it is given back.
/// </summary>
public sealed record StartOrderPaymentCommand(int OrderId, string? PayerUserId, string? PayerGuestId, string? PayerName, string? PayerPhone)
    : IRequest<StartedPayment>;

public class StartOrderPaymentCommandHandler(
    SalesContext context,
    IOnlinePaymentRepository payments,
    ITenantFeaturesQueries features,
    PaymentProviders providers,
    SecretSealer sealer,
    IOptions<PaymentsOptions> options,
    TimeProvider clock,
    ILogger<StartOrderPaymentCommandHandler> logger) : IRequestHandler<StartOrderPaymentCommand, StartedPayment>
{
    public async Task<StartedPayment> Handle(StartOrderPaymentCommand command, CancellationToken ct)
    {
        if (!await features.PayAheadAsync())
            throw new SalesDomainException("Paying ahead online is off here.");
        var settings = await payments.GetSettingsAsync();
        var provider = providers.For(settings)
            ?? throw new SalesDomainException("Online payments are not set up here yet.");

        await payments.LockOrderAsync(command.OrderId);
        var due = await context.OrderPaymentsDue.FindAsync([command.OrderId], ct);
        if (due is null || !due.IsPlacedBy(command.PayerUserId, command.PayerGuestId))
            throw new OrderPaymentNotFoundException();
        var now = clock.GetUtcNow().UtcDateTime;
        if (due.Status == OrderPaymentDueStatus.Paid)
            throw new SalesDomainException("This order is paid already.");
        if (due.Status == OrderPaymentDueStatus.Cancelled || now >= due.DueBy)
            throw new SalesDomainException("This order was cancelled: it was not paid in time.");

        var earlier = await payments.ListForOrderAsync(due.OrderId);
        if (earlier.Any(p => p.Secured))
            throw new SalesDomainException("This order is paid already.");
        foreach (var open in earlier) open.Cancel("Started again");

        var fee = settings.GuestFee(due.Amount);
        var payer = command.PayerUserId ?? command.PayerGuestId!;
        var name = string.IsNullOrWhiteSpace(command.PayerName) ? due.PayerName : command.PayerName.Trim();
        // Held, not charged, where the business has a card integration that holds: charged once the branch
        // accepts the order, let go at no cost if it does not. A pretend checkout holds too, so a demo shows it.
        var hold = provider is SimulatedPaymentProvider || settings.HoldsCards;
        var payment = payments.Add(OnlinePayment.StartForOrder(
            due.OrderId, due.BranchId, due.Amount, fee, settings.Currency, payer, name, provider.Name, now, hold));

        var items = new List<CheckoutItem> { new($"Order #{due.OrderId}", due.Amount) };
        if (fee > 0) items.Add(new("Online payment fee", fee));

        var session = await provider.StartCheckoutAsync(
            provider is SimulatedPaymentProvider ? PayRules.NoAccount : PayRules.Account(settings, sealer, hold),
            new CheckoutRequest(
                payment.Key.ToString("N"),
                payment.Charged,
                settings.Currency,
                items,
                name,
                command.PayerPhone ?? due.Phone,
                $"{options.Value.CallbackBaseUrl?.TrimEnd('/')}/api/sales/payments/paymob/callback",
                $"{options.Value.ReturnBaseUrl?.TrimEnd('/')}/pay/{payment.Key:N}"),
            ct);
        payment.Opened(session.ProviderReference);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);

        logger.LogInformation("Online payment {Key} started for order {OrderId}: {Amount}, fee {Fee} ({Provider} order {Reference})",
            payment.Key, due.OrderId, payment.Amount, fee, provider.Name, session.ProviderReference);
        return new StartedPayment(payment.Key, session.CheckoutUrl, payment.Amount, payment.Fee, payment.Charged);
    }
}

/// <summary>No such order for this caller: answered as missing, so an order's existence is not confirmed to a stranger.</summary>
public sealed class OrderPaymentNotFoundException() : SalesDomainException("No such order to pay.");

/// <summary>
/// The till confirmed an order paid ahead and its bill opened: the payment is put on the bill. A held
/// card is to be charged now (the branch accepted the order): the charge is recorded here, in this
/// transaction, and made once it commits (<see cref="PaymentMoves"/>; the returned key), which then
/// settles the bill. A payment charged at once (a wallet) settles the bill here and now ('online').
/// </summary>
/// <returns>The payment whose charge is to be made after the commit; null when there is none.</returns>
public sealed record SettlePaidAheadCommand(int OrderId, Guid PaymentKey, int TicketId) : IRequest<Guid?>;

public class SettlePaidAheadCommandHandler(
    IOnlinePaymentRepository payments,
    IMediator mediator,
    TimeProvider clock,
    ILogger<SettlePaidAheadCommandHandler> logger) : IRequestHandler<SettlePaidAheadCommand, Guid?>
{
    public async Task<Guid?> Handle(SettlePaidAheadCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.PaymentKey);
        if (payment is null || payment.OrderId != command.OrderId || !payment.Secured)
        {
            logger.LogWarning("Order {OrderId} was confirmed as paid ahead by {Key}, which is not its secured payment; bill {TicketId} stays open for the till",
                command.OrderId, command.PaymentKey, command.TicketId);
            return null;
        }

        payment.AttachToTicket(command.TicketId);
        if (payment.RequestCapture(GiveBackOrderPaymentsCommandHandler.By, clock.GetUtcNow().UtcDateTime))
        {
            await payments.UnitOfWork.SaveEntitiesAsync(ct);
            return payment.Key;
        }
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        if (payment.Status != OnlinePaymentStatus.Paid) return null;

        try
        {
            // The ticket's paid online payments are its tender (SettleTicketCommand folds them in)
            var settled = await mediator.Send(new SettleTicketCommand(command.TicketId, [], RecordPaymentMoveCommandHandler.SettledBy), ct);
            logger.LogInformation("Order {OrderId} paid ahead: bill {TicketId} settled online, receipt {Receipt}", command.OrderId, command.TicketId, settled.ReceiptNumber);
        }
        catch (SalesDomainException ex)
        {
            logger.LogWarning(ex, "Order {OrderId} paid ahead, but its bill {TicketId} could not settle itself; it stays open for the till", command.OrderId, command.TicketId);
        }
        return null;
    }
}

/// <summary>
/// An order paid ahead will not be made (cancelled, by the customer, the till or the clock; a delivery
/// that came back), or a payment it could not take (<paramref name="OnlyKey"/>): a checkout still open
/// is closed, and what was taken is to go back: a hold let go, a charge refunded (with a credit note when
/// its bill had settled). The moves are recorded here, in this transaction, and made once it commits
/// (<see cref="PaymentMoves"/>, given the returned keys); one the provider does not make at once is
/// tried again until it is, or shown to the owner.
/// </summary>
/// <returns>The payments with money to move after the commit.</returns>
public sealed record GiveBackOrderPaymentsCommand(int OrderId, Guid? OnlyKey, string Reason) : IRequest<IReadOnlyList<Guid>>;

public class GiveBackOrderPaymentsCommandHandler(
    SalesContext context,
    IOnlinePaymentRepository payments,
    TimeProvider clock,
    ILogger<GiveBackOrderPaymentsCommandHandler> logger) : IRequestHandler<GiveBackOrderPaymentsCommand, IReadOnlyList<Guid>>
{
    /// <summary>Who a move an order decided is recorded as asked by.</summary>
    public const string By = "ordering";

    public async Task<IReadOnlyList<Guid>> Handle(GiveBackOrderPaymentsCommand command, CancellationToken ct)
    {
        // A cancelled order no longer waits, paid or not; one refused a payment may still wait (it was paid twice)
        if (command.OnlyKey is null && await context.OrderPaymentsDue.FindAsync([command.OrderId], ct) is { Status: not OrderPaymentDueStatus.Cancelled } due)
            due.Status = OrderPaymentDueStatus.Cancelled;

        var now = clock.GetUtcNow().UtcDateTime;
        var toMove = new List<Guid>();
        foreach (var payment in await payments.ListForOrderAsync(command.OrderId))
        {
            if (command.OnlyKey is { } only && payment.Key != only) continue;
            try
            {
                if (payment.RequestGiveBack(By, command.Reason, now)) toMove.Add(payment.Key);
            }
            catch (SalesDomainException ex)
            {
                payment.NeedsAttention(ex.Message, now);
                logger.LogError(ex, "Online payment {Key} for order {OrderId} cannot be given back here", payment.Key, command.OrderId);
            }
        }

        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        if (toMove.Count > 0)
            logger.LogInformation("Order {OrderId}: {Count} online payment(s) to give back ({Reason})", command.OrderId, toMove.Count, command.Reason);
        return toMove;
    }
}
