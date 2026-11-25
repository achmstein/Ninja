namespace Ninja.IntegrationEventLogEF.Services;

public interface IIntegrationEventLogService
{
    Task<IEnumerable<IntegrationEventLogEntry>> RetrieveEventLogsPendingToPublishAsync(Guid transactionId);

    /// <summary>
    /// Events written but never marked published — the publish after the
    /// save failed, or the process died between the two — created before
    /// the given time and tried fewer than <paramref name="maxAttempts"/>
    /// times, oldest first, a batch at a time.
    /// </summary>
    Task<IEnumerable<IntegrationEventLogEntry>> RetrieveStuckEventLogsAsync(DateTime createdBefore, int maxAttempts);

    /// <summary>
    /// Events that used up their quick tries (the broker was out for longer
    /// than they last) and were created after the given time: tried again,
    /// slowly, rather than left for nobody to send. Oldest first, a batch at a time.
    /// </summary>
    Task<IEnumerable<IntegrationEventLogEntry>> RetrieveParkedEventLogsAsync(DateTime createdAfter, int minAttempts)
        => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());
    Task SaveEventAsync(IntegrationEvent @event, IDbContextTransaction transaction);
    Task MarkEventAsPublishedAsync(Guid eventId);
    Task MarkEventAsInProgressAsync(Guid eventId);
    Task MarkEventAsFailedAsync(Guid eventId);
}
