using Chillax.EventBus.Abstractions;
using Chillax.EventBus.Events;
using Chillax.IntegrationEventLogEF.Services;
using Chillax.Spaces.Infrastructure;

namespace Chillax.Spaces.API.Application.IntegrationEvents;

/// <summary>
/// Same outbox as Sales', over the Spaces context: the event log shares the
/// context's transaction, so the event and the rows it describes commit or
/// roll back together.
/// </summary>
public class SpacesIntegrationEventService(
    IEventBus eventBus,
    SpacesContext context,
    IIntegrationEventLogService integrationEventLogService,
    ILogger<SpacesIntegrationEventService> logger) : ISpacesIntegrationEventService
{
    public Task AddAndSaveEventAsync(IntegrationEvent evt)
    {
        var transaction = context.GetCurrentTransaction()
            ?? throw new InvalidOperationException(
                $"{evt.GetType().Name} was queued outside a unit of work; integration events are raised from domain event handlers, which run inside SpacesUnitOfWork.SaveEntitiesAsync");

        logger.LogInformation("Enqueuing integration event {IntegrationEventId} to the outbox ({@IntegrationEvent})", evt.Id, evt);

        return integrationEventLogService.SaveEventAsync(evt, transaction);
    }

    public async Task PublishPendingAsync(Guid transactionId)
    {
        var pending = await integrationEventLogService.RetrieveEventLogsPendingToPublishAsync(transactionId);

        foreach (var logEvt in pending)
        {
            logger.LogInformation("Publishing integration event {IntegrationEventId} ({@IntegrationEvent})", logEvt.EventId, logEvt.IntegrationEvent);

            try
            {
                await integrationEventLogService.MarkEventAsInProgressAsync(logEvt.EventId);
                await eventBus.PublishAsync(logEvt.IntegrationEvent);
                await integrationEventLogService.MarkEventAsPublishedAsync(logEvt.EventId);
            }
            catch (Exception ex)
            {
                // Left in the log as failed: the data is committed, the event
                // is still there to be republished
                logger.LogError(ex, "Error publishing integration event {IntegrationEventId}", logEvt.EventId);

                await integrationEventLogService.MarkEventAsFailedAsync(logEvt.EventId);
            }
        }
    }
}
