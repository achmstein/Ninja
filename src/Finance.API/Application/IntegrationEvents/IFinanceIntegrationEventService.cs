using Chillax.EventBus.Events;

namespace Chillax.Finance.API.Application.IntegrationEvents;

/// <summary>
/// The outbox. An integration event is written to the event log inside the
/// transaction that produced it and published only after that transaction
/// commits. A failed commit publishes nothing; a crash between commit and
/// publish loses nothing, because the log still holds the event. Nothing
/// leaves Finance yet (Phase 1); the outbox is here so that when something
/// does, it is never fire-and-forget.
/// </summary>
public interface IFinanceIntegrationEventService
{
    /// <summary>Queue an event on the current transaction's outbox.</summary>
    Task AddAndSaveEventAsync(IntegrationEvent evt);

    /// <summary>Publish everything a committed transaction queued.</summary>
    Task PublishEventsThroughEventBusAsync(Guid transactionId);
}
