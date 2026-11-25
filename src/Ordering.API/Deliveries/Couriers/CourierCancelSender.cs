#nullable enable

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Sends the queued cancels to the courier companies, oldest first, and keeps trying one the company
/// did not take: soon at first, then less often, for a day. One refused for good, or for a company
/// no longer connected, is given up with the reason kept.
/// </summary>
public sealed class CourierCancelSender(IServiceScopeFactory scopes, ILogger<CourierCancelSender> logger) : BackgroundService
{
    private static readonly TimeSpan Idle = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan GiveUpAfter = TimeSpan.FromDays(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendDueAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Sending courier cancels failed; trying again shortly");
            }

            try
            {
                await Task.Delay(Idle, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    /// <summary>How long after a failed attempt the next one is: 15 s, 30 s, 1 min, … never more than 15 min.</summary>
    public static TimeSpan Backoff(int attempts) =>
        TimeSpan.FromSeconds(Math.Min(15 * Math.Pow(2, Math.Max(0, attempts - 1)), 15 * 60));

    private async Task SendDueAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<OrderingContext>();
        var couriers = scope.ServiceProvider.GetRequiredService<ICourierDispatch>();
        var now = DateTime.UtcNow;

        var due = await context.CourierCancels
            .Where(c => c.SentAt == null && c.AbandonedAt == null && c.NextAttemptAt <= now)
            .OrderBy(c => c.Id)
            .Take(20)
            .ToListAsync(ct);
        if (due.Count == 0)
            return;

        foreach (var cancel in due)
        {
            var (done, giveUp, error) = await couriers.SendCancelAsync(cancel, ct);
            cancel.Attempts++;
            cancel.LastError = error;
            if (done)
                cancel.SentAt = DateTime.UtcNow;
            else if (giveUp || DateTime.UtcNow - cancel.CreatedAt > GiveUpAfter)
            {
                cancel.AbandonedAt = DateTime.UtcNow;
                logger.LogWarning("Gave up telling courier company {Company} to stop job {JobId} of order {OrderId}: {Error}",
                    cancel.CompanyId, cancel.JobId, cancel.OrderId, error);
            }
            else
                cancel.NextAttemptAt = DateTime.UtcNow + Backoff(cancel.Attempts);
        }
        await context.SaveChangesAsync(ct);
    }
}
