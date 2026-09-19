using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Inventory.Infrastructure;

namespace Ninja.Inventory.API.Application.IntegrationEvents;

/// <summary>
/// Same outbox as Ordering's, over the Inventory context: the event log shares
/// the context's transaction, so the event and the rows it describes commit
/// or roll back together.
/// </summary>
public class InventoryIntegrationEventService(
    IEventBus eventBus,
    InventoryContext inventoryContext,
    IIntegrationEventLogService integrationEventLogService,
    ILogger<InventoryIntegrationEventService> logger) : IInventoryIntegrationEventService
{
    public async Task AddAndSaveEventAsync(IntegrationEvent evt)
    {
        logger.LogInformation("Enqueuing integration event {IntegrationEventId} to the outbox ({@IntegrationEvent})", evt.Id, evt);

        await integrationEventLogService.SaveEventAsync(evt, inventoryContext.GetCurrentTransaction()!);
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
