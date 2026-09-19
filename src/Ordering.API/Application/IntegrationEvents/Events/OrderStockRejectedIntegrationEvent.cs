namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

public record ConfirmedOrderStockItem(int ProductId, bool HasStock);

public record OrderStockRejectedIntegrationEvent(int OrderId, List<ConfirmedOrderStockItem> OrderStockItems) : IntegrationEvent;
