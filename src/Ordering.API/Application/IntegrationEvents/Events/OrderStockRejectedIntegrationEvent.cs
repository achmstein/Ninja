namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

public record ConfirmedOrderStockItem(int ProductId, bool HasStock);

/// <summary>
/// What Catalog answered before it priced lines (now <see cref="OrderValidationFailedIntegrationEvent"/>).
/// Still read for one release, for answers queued when the stack was upgraded.
/// </summary>
public record OrderStockRejectedIntegrationEvent(int OrderId, List<ConfirmedOrderStockItem> OrderStockItems) : IntegrationEvent;
