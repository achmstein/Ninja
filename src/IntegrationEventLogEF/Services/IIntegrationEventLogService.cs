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
    Task SaveEventAsync(IntegrationEvent @event, IDbContextTransaction transaction);
    Task MarkEventAsPublishedAsync(Guid eventId);
    Task MarkEventAsInProgressAsync(Guid eventId);
    Task MarkEventAsFailedAsync(Guid eventId);
}
