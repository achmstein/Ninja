namespace Chillax.Spaces.Infrastructure;

/// <summary>
/// The publishing half of the outbox, as the unit of work sees it: once a
/// transaction has committed, everything it queued goes out on the bus.
/// Implemented in Spaces.API, which owns the bus; the infrastructure only
/// knows when to call it.
/// </summary>
public interface IOutboxPublisher
{
    Task PublishPendingAsync(Guid transactionId);
}
