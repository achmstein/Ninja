namespace Chillax.Contracts.Tests;

/// <summary>
/// The wiring gaps the codebase knowingly carries. Each list is exact: an
/// entry that stops being true fails the test until it is removed, so the
/// list never hides a fixed gap or a new one.
/// </summary>
public static class Allowlist
{
    /// <summary>Published, but no service subscribes (eShop leftovers).</summary>
    public static readonly string[] DeadPublishers =
    [
        "OrderStartedIntegrationEvent",
        "ProductPriceChangedIntegrationEvent",
        // Spaces publishes the places projection; Ordering and Notification subscribe in the next steps of the Places plan
        "PlaceUpdatedIntegrationEvent",
    ];

    /// <summary>Subscribed to, but no service publishes (eShop leftovers in Catalog).</summary>
    public static readonly string[] DeadConsumers =
    [
        "OrderStatusChangedToPaidIntegrationEvent",
        "OrderConfirmedWithPreferencesIntegrationEvent",
    ];
}
