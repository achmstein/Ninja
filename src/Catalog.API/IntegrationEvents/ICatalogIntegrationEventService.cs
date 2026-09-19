namespace Ninja.Catalog.API.IntegrationEvents;

public interface ICatalogIntegrationEventService
{
    Task SaveEventAndCatalogContextChangesAsync(IntegrationEvent evt);

    /// <summary>
    /// Saves the pending catalog changes and logs several events in one transaction.
    /// </summary>
    Task SaveEventsAndCatalogContextChangesAsync(IEnumerable<IntegrationEvent> events);
    Task PublishThroughEventBusAsync(IntegrationEvent evt);
}
