#nullable enable
using Microsoft.Extensions.Options;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.API.Payments;

/// <summary>The guest's choice of share, as their phone sends it.</summary>
public sealed record ShareRequest(SplitMode Mode, IReadOnlyList<int>? LineIds = null, int? Parts = null, int? Of = null, decimal? Amount = null);

public sealed record StartedPayment(Guid Key, string CheckoutUrl, decimal Amount, decimal Fee, decimal Charged);

/// <summary>
/// A guest starts paying their share: the share is worked out against what
/// is left (the ticket is locked meanwhile, so a second guest waits and sees
/// this one's hold), held, and the provider's checkout opened for it. A
/// provider that refuses leaves nothing behind: the transaction rolls back.
/// </summary>
public sealed record StartOnlinePaymentCommand(int TicketId, ShareRequest Share, string PayerId, string? PayerName, string? PayerPhone)
    : IRequest<StartedPayment>;

public class StartOnlinePaymentCommandHandler(
    ITicketRepository tickets,
    IOnlinePaymentRepository payments,
    ITenantFeaturesQueries features,
    PaymentProviders providers,
    SecretSealer sealer,
    IOptions<PaymentsOptions> options,
    TimeProvider clock,
    ILogger<StartOnlinePaymentCommandHandler> logger) : IRequestHandler<StartOnlinePaymentCommand, StartedPayment>
{
    public async Task<StartedPayment> Handle(StartOnlinePaymentCommand command, CancellationToken ct)
    {
        if (!await features.OnlinePaymentsAsync())
            throw new SalesDomainException("Online payments are off here.");
        var settings = await payments.GetSettingsAsync();
        var provider = providers.For(settings)
            ?? throw new SalesDomainException("This café has not set up online payments yet.");
        if (!settings.Allows(command.Share.Mode))
            throw new SalesDomainException("This café does not split bills that way.");

        await payments.LockTicketAsync(command.TicketId);
        var ticket = await tickets.GetAsync(command.TicketId)
            ?? throw new SalesDomainException("This bill does not exist.");
        PayRules.EnsurePayable(ticket);

        var now = clock.GetUtcNow().UtcDateTime;
        var others = await payments.ListForTicketAsync(ticket.Id);
        foreach (var stale in others) stale.Expire(now);

        var bill = ticket.GetBill(await tickets.GetPricingRulesAsync(ticket.BranchId));
        var share = command.Share.Mode switch
        {
            SplitMode.Full => OnlineShares.Full(bill, others, now),
            SplitMode.Items => OnlineShares.Items(ticket, bill, command.Share.LineIds ?? [], others, now),
            SplitMode.Equal => OnlineShares.Equal(bill, command.Share.Parts ?? 0, command.Share.Of ?? 0, others, now),
            SplitMode.Custom => OnlineShares.Custom(bill, command.Share.Amount ?? 0, others, now),
            _ => throw new SalesDomainException("Choose how to pay."),
        };

        var fee = settings.GuestFee(share.Amount);

        var payment = payments.Add(OnlinePayment.Start(
            ticket.Id, ticket.BranchId, share, fee, settings.Currency,
            command.PayerId, command.PayerName, provider.Name, now));

        var items = new List<CheckoutItem> { new(BillName(ticket), share.Amount) };
        if (fee > 0) items.Add(new("Online payment fee", fee));

        var session = await provider.StartCheckoutAsync(
            provider is SimulatedPaymentProvider ? PayRules.NoAccount : PayRules.Account(settings, sealer),
            new CheckoutRequest(
                payment.Key.ToString("N"),
                payment.Charged,
                settings.Currency,
                items,
                command.PayerName ?? "Guest",
                command.PayerPhone,
                $"{options.Value.CallbackBaseUrl?.TrimEnd('/')}/api/sales/payments/paymob/callback",
                $"{options.Value.ReturnBaseUrl?.TrimEnd('/')}/pay/{payment.Key:N}"),
            ct);
        payment.Opened(session.ProviderReference);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);

        logger.LogInformation(
            "Online payment {Key} started on ticket {TicketId}: {Mode} share {Amount}, fee {Fee} ({Provider} order {Reference})",
            payment.Key, ticket.Id, share.Mode, share.Amount, fee, provider.Name, session.ProviderReference);

        return new StartedPayment(payment.Key, session.CheckoutUrl, payment.Amount, payment.Fee, payment.Charged);
    }

    private static string BillName(Ticket ticket)
        => ticket.LocationName?.En is { Length: > 0 } place ? $"Bill share, {place}" : "Bill share";
}

public sealed record ConfirmedPayment(int TicketId, bool Paid);

/// <summary>
/// The provider's verified callback: the payment it names is paid or failed.
/// A repeated callback changes nothing. A payment that arrives for a bill
/// the till already closed is kept as paid and logged for a refund.
/// </summary>
public sealed record ConfirmOnlinePaymentCommand(CallbackOutcome Outcome, string Provider) : IRequest<ConfirmedPayment?>;

public class ConfirmOnlinePaymentCommandHandler(
    IOnlinePaymentRepository payments,
    ITicketRepository tickets,
    ISalesIntegrationEventService integrationEvents,
    TimeProvider clock,
    ILogger<ConfirmOnlinePaymentCommandHandler> logger) : IRequestHandler<ConfirmOnlinePaymentCommand, ConfirmedPayment?>
{
    public async Task<ConfirmedPayment?> Handle(ConfirmOnlinePaymentCommand command, CancellationToken ct)
    {
        var outcome = command.Outcome;
        var payment = await payments.FindByProviderReferenceAsync(command.Provider, outcome.ProviderReference);
        if (payment is null && Guid.TryParse(outcome.OurReference, out var key))
            payment = await payments.GetByKeyAsync(key);
        if (payment is null)
        {
            logger.LogWarning("A {Provider} callback for order {Reference} matches no payment", command.Provider, outcome.ProviderReference);
            return null;
        }

        // Still in progress at the provider (a wallet waiting on the guest): the hold stands
        if (outcome.Pending) return new(payment.TicketId, false);

        bool changed;
        if (outcome.Success)
        {
            if (outcome.Amount != payment.Charged)
                logger.LogWarning("Online payment {Key}: {Provider} charged {Charged}, expected {Expected}", payment.Key, command.Provider, outcome.Amount, payment.Charged);
            try
            {
                changed = payment.MarkPaid(outcome.TransactionId, clock.GetUtcNow().UtcDateTime);
            }
            catch (SalesDomainException ex)
            {
                // A second transaction for a paid checkout: the money is at the provider, for the owner to look into
                logger.LogWarning(ex, "Online payment {Key}: {Provider} reports transaction {Transaction} too", payment.Key, command.Provider, outcome.TransactionId);
                return new(payment.TicketId, payment.Status == OnlinePaymentStatus.Paid);
            }
        }
        else
        {
            changed = payment.MarkFailed(outcome.Error ?? "declined");
        }
        if (!changed) return new(payment.TicketId, payment.Status == OnlinePaymentStatus.Paid);

        await payments.UnitOfWork.SaveEntitiesAsync(ct);

        var ticket = await tickets.GetAsync(payment.TicketId);
        if (payment.Status == OnlinePaymentStatus.Paid && ticket is not null && ticket.Status != TicketStatus.Open)
            logger.LogWarning("Online payment {Key} of {Amount} arrived after ticket {TicketId} was {Status}: refund it", payment.Key, payment.Amount, ticket.Id, ticket.Status);

        // The till's floor and the guests' phones refetch
        if (ticket is not null)
            await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(ticket.Id, ticket.BranchId));

        logger.LogInformation("Online payment {Key} on ticket {TicketId} is {Status}", payment.Key, payment.TicketId, payment.Status);
        return new(payment.TicketId, payment.Status == OnlinePaymentStatus.Paid);
    }
}

/// <summary>
/// A bill its guests have paid in full online settles itself, as "online",
/// once nothing about it is still moving: no clock running, no checkout
/// open. Otherwise the till settles it, the online payments counted in.
/// </summary>
public sealed record SettlePaidOnlineCommand(int TicketId) : IRequest<bool>;

public class SettlePaidOnlineCommandHandler(
    ITicketRepository tickets,
    IOnlinePaymentRepository payments,
    IMediator mediator,
    TimeProvider clock) : IRequestHandler<SettlePaidOnlineCommand, bool>
{
    public const string SettledBy = "online";

    public async Task<bool> Handle(SettlePaidOnlineCommand command, CancellationToken ct)
    {
        var ticket = await tickets.GetAsync(command.TicketId);
        if (ticket is null || ticket.Status != TicketStatus.Open) return false;
        if (ticket.HasSession && ticket.SessionEndedAt is null) return false;

        var now = clock.GetUtcNow().UtcDateTime;
        var online = await payments.ListForTicketAsync(ticket.Id);
        if (online.Any(p => p.Status == OnlinePaymentStatus.Pending && p.Holds(now))) return false;

        var bill = ticket.GetBill(await tickets.GetPricingRulesAsync(ticket.BranchId));
        if (OnlineShares.Paid(online) < bill.Total) return false;

        await mediator.Send(new SettleTicketCommand(ticket.Id, [], SettledBy), ct);
        return true;
    }
}

/// <summary>
/// A checkout nobody finished: its payer took it back, or the till let it
/// go. The share is free again at once rather than when the hold runs out.
/// </summary>
/// <param name="PayerId">The guest asking, who must be the one paying; null when the till asks.</param>
public sealed record CancelOnlinePaymentCommand(Guid Key, string? PayerId, string By) : IRequest<bool>;

public class CancelOnlinePaymentCommandHandler(
    IOnlinePaymentRepository payments,
    ITicketRepository tickets,
    ISalesIntegrationEventService integrationEvents,
    ILogger<CancelOnlinePaymentCommandHandler> logger) : IRequestHandler<CancelOnlinePaymentCommand, bool>
{
    public async Task<bool> Handle(CancelOnlinePaymentCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.Key);
        if (payment is null || (command.PayerId is not null && payment.PayerId != command.PayerId)) return false;
        if (!payment.Cancel(command.PayerId is null ? "Released at the till" : "Cancelled by the guest"))
            throw new SalesDomainException("This payment is already " + payment.Status.ToString().ToLowerInvariant() + ".");
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        if (await tickets.GetAsync(payment.TicketId) is { } ticket)
            await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(ticket.Id, ticket.BranchId));
        logger.LogInformation("Online payment {Key} on ticket {TicketId} let go by {By}", payment.Key, payment.TicketId, command.By);
        return true;
    }
}

/// <summary>
/// Gives a guest's online payment back through the provider, while the
/// bill is still open (the share is owed again). A settled bill is refunded
/// the usual way, with a credit note, and the money from the provider's
/// dashboard.
/// </summary>
public sealed record RefundOnlinePaymentCommand(Guid Key, string By) : IRequest<Unit>;

public class RefundOnlinePaymentCommandHandler(
    IOnlinePaymentRepository payments,
    ITicketRepository tickets,
    PaymentProviders providers,
    SecretSealer sealer,
    ISalesIntegrationEventService integrationEvents,
    TimeProvider clock) : IRequestHandler<RefundOnlinePaymentCommand, Unit>
{
    public async Task<Unit> Handle(RefundOnlinePaymentCommand command, CancellationToken ct)
    {
        var payment = await payments.GetByKeyAsync(command.Key)
            ?? throw new SalesDomainException("No such payment.");
        var ticket = await tickets.GetAsync(payment.TicketId);
        if (ticket is { Status: not TicketStatus.Open })
            throw new SalesDomainException("This bill is closed; refund it from the receipt, and the money from the provider's dashboard.");
        if (payment.Status != OnlinePaymentStatus.Paid || payment.TransactionId is null)
            throw new SalesDomainException("Only a paid payment can be refunded.");

        var provider = providers.ByName(payment.Provider);
        var account = provider is SimulatedPaymentProvider ? PayRules.NoAccount : PayRules.Account(await payments.GetSettingsAsync(), sealer);
        await provider.RefundAsync(account, payment.TransactionId, payment.Charged, ct);
        payment.Refund(command.By, clock.GetUtcNow().UtcDateTime);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        if (ticket is not null)
            await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(ticket.Id, ticket.BranchId));
        return Unit.Value;
    }
}

/// <param name="SecretKey">Null leaves it as it is; empty clears it.</param>
/// <param name="HmacSecret">Likewise.</param>
public sealed record SavePaymentSettingsCommand(
    string Currency,
    string? SecretKey,
    string? PublicKey,
    string? HmacSecret,
    int? CardIntegrationId,
    int? WalletIntegrationId,
    int? ApplePayIntegrationId,
    FeeMode FeeMode,
    decimal FeePercent,
    decimal FeeFixed,
    bool AllowItems,
    bool AllowEqual,
    bool AllowCustom) : IRequest<PaymentSettings>;

public class SavePaymentSettingsCommandHandler(
    IOnlinePaymentRepository payments,
    SecretSealer sealer,
    TimeProvider clock) : IRequestHandler<SavePaymentSettingsCommand, PaymentSettings>
{
    public async Task<PaymentSettings> Handle(SavePaymentSettingsCommand command, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var settings = await payments.GetSettingsAsync();
        settings.Update(
            command.Currency, command.PublicKey, command.CardIntegrationId, command.WalletIntegrationId, command.ApplePayIntegrationId,
            command.FeeMode, command.FeePercent, command.FeeFixed,
            command.AllowItems, command.AllowEqual, command.AllowCustom, now);

        if (command.SecretKey is not null || command.HmacSecret is not null)
        {
            if (!sealer.CanSeal)
                throw new SalesDomainException("This café cannot keep payment secrets yet; ask for its stack to be upgraded.");
            string? Seal(string? value) => value is null ? null : value.Trim().Length == 0 ? "" : sealer.Seal(value.Trim());
            var key = command.SecretKey?.Trim();
            settings.SetSecrets(Seal(command.SecretKey), key is { Length: >= 4 } ? key[^4..] : null, Seal(command.HmacSecret), now);
        }

        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        return settings;
    }
}

/// <summary>What every payment command asks of a bill and an account.</summary>
public static class PayRules
{
    /// <summary>Open, at a place (a counter sale is paid at the counter), and its total no longer moving.</summary>
    public static void EnsurePayable(Ticket ticket)
    {
        if (ticket.Status != TicketStatus.Open)
            throw new SalesDomainException("This bill is already closed.");
        if (ticket.PlaceId is null)
            throw new SalesDomainException("Only a table's or a room's bill is paid from a phone.");
        if (ticket.HasSession && ticket.SessionEndedAt is null)
            throw new SalesDomainException("The clock is still running; pay once it stops.");
        if (ticket.Lines.Count == 0)
            throw new SalesDomainException("There is nothing on this bill yet.");
    }

    /// <summary>What a simulated payment is made on: no account at all.</summary>
    public static readonly ProviderAccount NoAccount = new("", null, null, []);

    public static ProviderAccount Account(PaymentSettings settings, SecretSealer sealer)
    {
        if (settings.SealedSecretKey is null)
            throw new SalesDomainException("This café has not set up online payments yet.");
        return new ProviderAccount(
            sealer.Open(settings.SealedSecretKey),
            settings.PublicKey,
            settings.SealedHmacSecret is null ? null : sealer.Open(settings.SealedHmacSecret),
            settings.IntegrationIds);
    }
}
