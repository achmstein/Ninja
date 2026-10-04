using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.IntegrationEventLogEF.Services;
using Ninja.IntegrationEventLogEF.Utilities;

namespace Ninja.Tenant.API.Services;

/// <summary>
/// Tenant's outbox. A change and the events that tell of it are saved in one
/// transaction, then published straight after; if the publish fails, or the
/// process dies between the two, the outbox relay sends them later. The
/// switches and a branch's delivery terms (its fee, its area) ride on these
/// events, so Ordering must never be left quoting what the owner changed.
/// </summary>
public sealed class TenantEvents(
    TenantContext context,
    IEventBus eventBus,
    IIntegrationEventLogService log,
    ILogger<TenantEvents> logger)
{
    /// <summary>Save what is pending on the context with <paramref name="events"/>, then publish them.</summary>
    public async Task SaveAndPublishAsync(params IntegrationEvent[] events)
    {
        await ResilientTransaction.New(context).ExecuteAsync(async () =>
        {
            await context.SaveChangesAsync();
            foreach (var @event in events)
            {
                await log.SaveEventAsync(@event, context.Database.CurrentTransaction!);
            }
        });

        foreach (var @event in events)
        {
            try
            {
                await log.MarkEventAsInProgressAsync(@event.Id);
                await eventBus.PublishAsync(@event);
                await log.MarkEventAsPublishedAsync(@event.Id);
            }
            catch (Exception ex)
            {
                // Saved with the change: the outbox relay sends it later
                logger.LogError(ex, "Publishing integration event {IntegrationEventId} ({EventType}) failed; the outbox relay will send it",
                    @event.Id, @event.GetType().Name);
                await log.MarkEventAsFailedAsync(@event.Id);
            }
        }
    }
}
