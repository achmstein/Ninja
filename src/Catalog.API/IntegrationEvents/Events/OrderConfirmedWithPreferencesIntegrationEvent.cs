namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when an order is confirmed, containing customization data
/// for saving user preferences.
/// </summary>
public record OrderConfirmedWithPreferencesIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public string BuyerIdentityGuid { get; }
    public List<OrderItemWithCustomizations> Items { get; }

    public OrderConfirmedWithPreferencesIntegrationEvent(
        int orderId,
        string buyerIdentityGuid,
        List<OrderItemWithCustomizations> items)
    {
        OrderId = orderId;
        BuyerIdentityGuid = buyerIdentityGuid;
        Items = items;
    }
}

/// <summary>
/// Order item with customization selections
/// </summary>
public record OrderItemWithCustomizations
{
    public int ProductId { get; init; }
    public List<SelectedCustomization> Customizations { get; init; } = new();
}

/// <summary>
/// A selected customization option
/// </summary>
public record SelectedCustomization
{
    public int CustomizationId { get; init; }
    public int OptionId { get; init; }
}
