#nullable enable
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Payments;

/// <summary>
/// Asks the provider how payments stand, where the business gave its API key (the lookups need it):
/// a checkout whose callback is late is caught up with (the customer paid, the callback was lost or
/// is slow), and each day's payments are checked against the provider's records, any disagreement
/// shown to the owner. A payment the provider took that we had as failed or expired goes through
/// the callback's own path (<see cref="ConfirmOnlinePaymentCommand"/>), so whatever follows a payment
/// follows it here too, including giving it back when its order can no longer take it.
/// </summary>
public sealed class PaymentChecks(IServiceScopeFactory scopes, TimeProvider clock, ILogger<PaymentChecks> logger)
{
    /// <summary>A checkout is not asked after before this: the callback usually comes first.</summary>
    public static readonly TimeSpan CheckoutGrace = TimeSpan.FromSeconds(20);

    /// <summary>Nor more often than this, whoever asks (the customer's return page polls).</summary>
    public static readonly TimeSpan CheckEvery = TimeSpan.FromSeconds(10);

    /// <summary>Checkouts are asked after for this long; past it, the daily check finds what is left.</summary>
    public static readonly TimeSpan CheckoutWatch = TimeSpan.FromHours(2);

    /// <summary>How far back the daily check reaches, at most.</summary>
    public static readonly TimeSpan ReconcileReach = TimeSpan.FromDays(3);

    /// <summary>
    /// A checkout still open (or let go for want of a word from the provider): did the customer pay?
    /// True when the provider's answer changed it.
    /// </summary>
    public async Task<bool> CheckCheckoutAsync(Guid key, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        var payments = services.GetRequiredService<IOnlinePaymentRepository>();
        var now = clock.GetUtcNow().UtcDateTime;

        var payment = await payments.GetByKeyAsync(key);
        if (payment is null
            || payment.Status is not (OnlinePaymentStatus.Pending or OnlinePaymentStatus.Expired)
            || payment.CreatedAt > now - CheckoutGrace
            || payment.CheckedAt > now - CheckEvery)
            return false;

        var (provider, account) = await AccountAsync(services, payment);
        if (account?.ApiKey is null) return false;

        payment.Checked(now);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);

        ProviderTransaction? found;
        try
        {
            found = await provider.FindByReferenceAsync(account, payment.Key.ToString("N"), ct);
        }
        catch (PaymentProviderException ex)
        {
            logger.LogInformation(ex, "Online payment {Key}: {Provider} could not say whether it was paid", key, provider.Name);
            return false;
        }
        if (found is null || found.Pending) return false;

        logger.LogWarning("Online payment {Key}: no callback yet, but {Provider} says transaction {Transaction} {Outcome}; taking its word",
            key, provider.Name, found.TransactionId, found.Success ? "went through" : "failed");
        var confirmed = await services.GetRequiredService<IMediator>().Send(new ConfirmOnlinePaymentCommand(Outcome(payment, found), provider.Name), ct);
        return confirmed is not null;
    }

    /// <summary>
    /// Every payment of the last days with a transaction, checked against the provider's record of it.
    /// Payments with a move under way are left to it. Returns how many disagreed.
    /// </summary>
    public async Task<int> ReconcileAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<SalesContext>();
        var payments = services.GetRequiredService<IOnlinePaymentRepository>();
        var now = clock.GetUtcNow().UtcDateTime;
        var settings = await payments.GetSettingsAsync();
        if (settings.SealedApiKey is null) return 0;

        var since = settings.ReconciledAt is { } last && last > now - ReconcileReach ? last - TimeSpan.FromHours(1) : now - ReconcileReach;
        var keys = await db.OnlinePayments.AsNoTracking()
            .Where(p => p.TransactionId != null && p.Move == PaymentMove.None && p.Provider != SimulatedPaymentProvider.ProviderName)
            .Where(p => p.CreatedAt >= since || p.PaidAt >= since || p.AuthorizedAt >= since || p.VoidedAt >= since || p.RefundedAt >= since)
            .OrderBy(p => p.CreatedAt)
            .Select(p => p.Key)
            .Take(2000)
            .ToListAsync(ct);

        var disagreed = 0;
        foreach (var key in keys)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                if (await CheckOneAsync(key, ct)) disagreed++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Online payment {Key} could not be checked against the provider today", key);
            }
        }

        settings.Reconciled(now);
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        logger.LogInformation("Checked {Count} online payment(s) against the provider; {Disagreed} disagreed", keys.Count, disagreed);
        return disagreed;
    }

    /// <summary>One payment against the provider's record; true when they disagreed.</summary>
    private async Task<bool> CheckOneAsync(Guid key, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        var payments = services.GetRequiredService<IOnlinePaymentRepository>();
        var payment = await payments.GetByKeyAsync(key);
        if (payment?.TransactionId is not { } transactionId || payment.Move != PaymentMove.None) return false;

        var (provider, account) = await AccountAsync(services, payment);
        if (account?.ApiKey is null) return false;
        var theirs = await provider.LookupAsync(account, transactionId, ct);
        if (theirs is null) return false;

        var now = clock.GetUtcNow().UtcDateTime;
        payment.Checked(now);

        // Taken at the provider, failed or let go here: the callback's path takes it (and gives it back if it must)
        if (theirs.Success && !theirs.Voided && !theirs.Refunded && payment.Status is OnlinePaymentStatus.Failed or OnlinePaymentStatus.Expired)
        {
            await payments.UnitOfWork.SaveEntitiesAsync(ct);
            await services.GetRequiredService<IMediator>().Send(new ConfirmOnlinePaymentCommand(Outcome(payment, theirs), provider.Name), ct);
            return true;
        }

        var problem = Disagreement(payment, theirs);
        if (problem is not null)
        {
            payment.NeedsAttention(problem, now);
            logger.LogError("Online payment {Key} disagrees with {Provider}: {Problem}", key, provider.Name, problem);
        }
        await payments.UnitOfWork.SaveEntitiesAsync(ct);
        return problem is not null;
    }

    /// <summary>Why our record and the provider's do not agree, in the owner's words; null when they do.</summary>
    internal static string? Disagreement(OnlinePayment ours, ProviderTransaction theirs)
    {
        var said = Said(theirs);
        return ours.Status switch
        {
            OnlinePaymentStatus.Paid when !theirs.Success || theirs.Voided || theirs.Refunded || (theirs.IsAuth && !theirs.Captured)
                => $"We have this payment as paid; Paymob says it {said}.",
            OnlinePaymentStatus.Authorized when !theirs.Success || theirs.Voided || theirs.Captured || theirs.Refunded
                => $"We have this card as held; Paymob says it {said}.",
            OnlinePaymentStatus.Voided when !theirs.Voided && theirs.Success
                => $"We let this hold go; Paymob says it {said}.",
            OnlinePaymentStatus.Refunded when !theirs.Refunded && !theirs.Voided && theirs.Success
                => $"We refunded this payment; Paymob says it {said}.",
            _ => null,
        };
    }

    private static string Said(ProviderTransaction t) => t switch
    {
        { Refunded: true } => "was refunded",
        { Voided: true } => "was let go uncharged",
        { IsAuth: true, Captured: true } => "was held and charged",
        { IsAuth: true, Success: true } => "is held, not charged",
        { Success: true } => "was charged",
        _ => $"did not go through{(t.Error is null ? "" : $" ({t.Error})")}",
    };

    private static CallbackOutcome Outcome(OnlinePayment payment, ProviderTransaction found) => new(
        found.ProviderReference ?? payment.ProviderReference ?? "",
        payment.Key.ToString("N"),
        found.TransactionId,
        found.Success,
        found.Pending,
        found.Amount,
        found.Error,
        IsAuth: found.IsAuth && !found.Captured);

    private static async Task<(IPaymentProvider Provider, ProviderAccount? Account)> AccountAsync(IServiceProvider services, OnlinePayment payment)
    {
        var provider = services.GetRequiredService<PaymentProviders>().ByName(payment.Provider);
        if (provider is SimulatedPaymentProvider) return (provider, null);
        var settings = await services.GetRequiredService<IOnlinePaymentRepository>().GetSettingsAsync();
        if (settings.SealedSecretKey is null || settings.SealedApiKey is null) return (provider, null);
        return (provider, PayRules.Account(settings, services.GetRequiredService<SecretSealer>(), payment.CardHold));
    }
}

/// <summary>
/// The payments' clockwork, every half minute: money moves owed and due are made (a charge, a hold let
/// go, a refund the provider did not make at once, each retried as <see cref="OnlinePayment.Backoff"/>
/// says); checkouts whose callback is late are asked after, once a minute; and once a day the payments
/// are checked against the provider's records. Each runs on whichever instance gets to it: a move is
/// leased before it is made, so two instances never make the same one.
/// </summary>
public sealed class PaymentsWorker(
    IServiceScopeFactory scopes,
    PaymentMoves moves,
    PaymentChecks checks,
    TimeProvider clock,
    ILogger<PaymentsWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    /// <summary>At most this many moves, and this many checkouts, a round, so one round never runs long.</summary>
    private const int Batch = 50;

    private DateTime _checkedCheckoutsAt;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(20), clock, stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RoundAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "A round of the payments' clockwork failed; the next round tries again");
            }
            await Task.Delay(Interval, clock, stoppingToken);
        }
    }

    /// <summary>One round: moves due, then (each minute) late checkouts, then (each day) the check against the provider.</summary>
    public async Task RoundAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        List<Guid> due;
        List<Guid> late = [];
        bool reconcile;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
            due = await db.OnlinePayments.AsNoTracking()
                .Where(p => p.Move != PaymentMove.None && p.MoveDueAt <= now && (p.MoveLeasedUntil == null || p.MoveLeasedUntil < now))
                .OrderBy(p => p.MoveDueAt)
                .Select(p => p.Key)
                .Take(Batch)
                .ToListAsync(ct);

            if (now - _checkedCheckoutsAt >= TimeSpan.FromMinutes(1))
            {
                _checkedCheckoutsAt = now;
                var from = now - PaymentChecks.CheckoutWatch;
                var to = now - TimeSpan.FromSeconds(90);
                late = await db.OnlinePayments.AsNoTracking()
                    .Where(p => p.Status == OnlinePaymentStatus.Pending || p.Status == OnlinePaymentStatus.Expired)
                    .Where(p => p.CreatedAt >= from && p.CreatedAt <= to && p.Provider != SimulatedPaymentProvider.ProviderName)
                    // Each a minute for its first half hour, then every ten
                    .Where(p => p.CheckedAt == null || p.CheckedAt < now.AddMinutes(-1) && p.CreatedAt > now.AddMinutes(-30) || p.CheckedAt < now.AddMinutes(-10))
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => p.Key)
                    .Take(Batch)
                    .ToListAsync(ct);
            }

            var settings = await db.PaymentSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            reconcile = settings is { SealedApiKey: not null } && (settings.ReconciledAt is null || settings.ReconciledAt < now.AddDays(-1));
        }

        foreach (var key in due)
            await moves.TryRunAsync(key, ct);

        foreach (var key in late)
        {
            try
            {
                await checks.CheckCheckoutAsync(key, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Online payment {Key}: could not ask after its checkout this round", key);
            }
        }

        if (reconcile)
            await checks.ReconcileAsync(ct);
    }
}
