using Chillax.EventBus.Events;

namespace Chillax.Inventory.API.Application.IntegrationEvents;

/// <summary>
/// The outbox. An integration event is written to the event log inside the
/// transaction that produced it and published only after that transaction
/// commits. A failed commit publishes nothing; a crash between commit and
/// publish loses nothing, because the log still holds the event. Sold-out
/// and low-stock signals leave Inventory this way, so nothing here may be
/// fire-and-forget.
/// </summary>
public interface IInventoryIntegrationEventService
{
    /// <summary>Queue an event on the current transaction's outbox.</summary>
    Task AddAndSaveEventAsync(IntegrationEvent evt);

    /// <summary>Publish everything a committed transaction queued.</summary>
    Task PublishEventsThroughEventBusAsync(Guid transactionId);
}
