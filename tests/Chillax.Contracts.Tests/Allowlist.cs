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
    ];

    /// <summary>Subscribed to, but no service publishes (eShop leftovers in Catalog).</summary>
    public static readonly string[] DeadConsumers =
    [
        "OrderStatusChangedToPaidIntegrationEvent",
        "OrderConfirmedWithPreferencesIntegrationEvent",
    ];
}
