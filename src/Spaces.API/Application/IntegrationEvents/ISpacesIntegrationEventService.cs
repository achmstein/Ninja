using Ninja.EventBus.Events;
using Ninja.Spaces.Infrastructure;

namespace Ninja.Spaces.API.Application.IntegrationEvents;

/// <summary>
/// The outbox, as Sales and Ordering have it. An integration event is written
/// to the event log inside the transaction that produced it and published
/// only after that transaction commits. A failed commit publishes nothing; a
/// crash between commit and publish loses nothing, because the log still
/// holds the event. A stay's start is what opens its bill in Sales and its
/// end is what puts the time on it, so nothing here may be fire-and-forget.
/// </summary>
public interface ISpacesIntegrationEventService : IOutboxPublisher
{
    /// <summary>Queue an event on the current unit of work's outbox.</summary>
    Task AddAndSaveEventAsync(IntegrationEvent evt);
}
