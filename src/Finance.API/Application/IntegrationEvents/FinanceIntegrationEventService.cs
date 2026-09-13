using Chillax.EventBus.Abstractions;
using Chillax.EventBus.Events;
using Chillax.Finance.Infrastructure;

namespace Chillax.Finance.API.Application.IntegrationEvents;

/// <summary>
/// Same outbox as Ordering's, over the Finance context: the event log shares
/// the context's transaction, so the event and the rows it describes commit
/// or roll back together.
/// </summary>
public class FinanceIntegrationEventService(
    IEventBus eventBus,
    FinanceContext financeContext,
    IIntegrationEventLogService integrationEventLogService,
    ILogger<FinanceIntegrationEventService> logger) : IFinanceIntegrationEventService
{
    public async Task AddAndSaveEventAsync(IntegrationEvent evt)
    {
        logger.LogInformation("Enqueuing integration event {IntegrationEventId} to the outbox ({@IntegrationEvent})", evt.Id, evt);

        await integrationEventLogService.SaveEventAsync(evt, financeContext.GetCurrentTransaction()!);
    }

    public async Task PublishEventsThroughEventBusAsync(Guid transactionId)
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
