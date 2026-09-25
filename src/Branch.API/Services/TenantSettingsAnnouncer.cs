using Ninja.Branch.API.IntegrationEvents;
using Ninja.Branch.API.Model;
using Ninja.EventBus.Abstractions;

namespace Ninja.Branch.API.Services;

/// <summary>
/// Says the café's own settings once each time the service starts, so a
/// consumer that has never heard them — a stack upgraded from when they rode
/// on every branch's event, a service whose copy was lost — has them without
/// the owner touching a switch. Saying the same thing again changes nothing
/// on the other side. Registered after the migration, so the tenant row is
/// there; the bus connects on its own thread, so the first tries may find it
/// not yet open and wait.
/// </summary>
public class TenantSettingsAnnouncer(
    IServiceScopeFactory scopes,
    IEventBus eventBus,
    ILogger<TenantSettingsAnnouncer> logger) : BackgroundService
{
    private static readonly TimeSpan FirstWait = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan LongestWait = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var wait = FirstWait;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await AnnounceAsync(stoppingToken);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Could not say the café's settings yet; trying again in {Wait}", wait);
            }

            await Task.Delay(wait, stoppingToken);
            wait = TimeSpan.FromTicks(Math.Min(wait.Ticks * 2, LongestWait.Ticks));
        }
    }

    public async Task AnnounceAsync(CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<BranchContext>();
        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Tenant.SingletonId, ct);

        await eventBus.PublishAsync(TenantSettingsChangedIntegrationEvent.From(tenant));

        logger.LogInformation("Said the café's settings: guest orders anywhere {GuestOrdersAnywhere}", tenant.GuestOrdersAnywhere);
    }
}
