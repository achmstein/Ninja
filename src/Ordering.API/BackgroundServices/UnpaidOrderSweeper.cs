namespace Ninja.Ordering.API.BackgroundServices;

/// <summary>
/// Cancels orders paid ahead online that were not paid within
/// <see cref="Order.PayAheadWindow"/>, and those paid that the branch did not
/// accept in time (PayAheadOptions.AcceptWithin), once a minute. The work is a command
/// (ExpirePaidAheadOrdersCommand) so it runs in a transaction with its events.
/// </summary>
public class UnpaidOrderSweeper(
    IServiceScopeFactory scopeFactory,
    ILogger<UnpaidOrderSweeper> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the app come up first
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                await mediator.Send(new ExpirePaidAheadOrdersCommand(DateTime.UtcNow), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Sweeping unpaid orders failed; the next sweep tries again");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }
}
