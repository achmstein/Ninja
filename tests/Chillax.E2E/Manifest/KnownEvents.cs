namespace Chillax.E2E.Manifest;

/// <summary>
/// Every integration event declared under src/ (routing key = CLR short name),
/// with who publishes and who subscribes. The guard test fails when a new
/// event appears in the source without being listed here; the contract tests
/// (tests/Chillax.Contracts.Tests) check the publisher/consumer wiring itself.
/// </summary>
public static class KnownEvents
{
    public const string Suffix = "IntegrationEvent";

    public sealed record Choreography(string Name, string Publisher, string[] Consumers);

    public static readonly Choreography[] Catalog =
    [
        new("BranchSettingsChanged", "Branch", ["Ordering", "Spaces", "Notification"]),
        new("CashMoved", "Sales", ["Finance"]),
        new("CashPaidOut", "Sales", ["Payroll"]),
        new("CatalogItemAvailabilityChanged", "Catalog", ["Notification"]),
        new("CatalogItemStockChanged", "Inventory", ["Catalog"]),
        new("CatalogOptionStockChanged", "Inventory", ["Catalog"]),
        new("EmployeeEarningsChanged", "Payroll", ["Finance"]),
        new("OrderConfirmedWithPreferences", "", ["Catalog"]),          // dead consumer: nobody publishes it
        new("OrderCustomerAssigned", "Ordering", ["Sales", "Loyalty"]),
        new("OrderReadyChanged", "Ordering", ["Notification"]),
        new("OrderReminder", "Ordering", ["Notification"]),
        new("OrderStarted", "Ordering", []),                            // dead publisher: nobody subscribes
        new("OrderStatusChangedToAwaitingValidation", "Ordering", ["Catalog"]),
        new("OrderStatusChangedToCancelled", "Ordering", ["Notification"]),
        new("OrderStatusChangedToConfirmed", "Ordering", ["Sales", "Inventory", "Loyalty", "Catalog", "Notification"]),
        new("OrderStatusChangedToPaid", "", ["Catalog"]),               // dead consumer
        new("OrderStatusChangedToSubmitted", "Ordering", ["Notification"]),
        new("OrderStockConfirmed", "Catalog", ["Ordering"]),
        new("OrderStockRejected", "Catalog", ["Ordering"]),
        new("PlaceUpdated", "Spaces", []),                              // consumers arrive with the Ordering and Notification places steps
        new("ProductPriceChanged", "Catalog", []),                      // dead publisher
        new("PurchaseReceived", "Inventory", ["Finance"]),
        new("ReservationCancelled", "Spaces", ["Sales", "Notification"]),
        new("RoomBecameAvailable", "Spaces", ["Notification"]),
        new("RoomReserved", "Spaces", ["Notification"]),
        new("ServiceRequestCreated", "Notification", ["Notification"]),
        new("SessionCompleted", "Spaces", ["Sales"]),
        new("SessionCustomerAssigned", "Spaces", ["Notification"]),
        new("SessionEnded", "Spaces", ["Notification"]),
        new("SessionMemberJoined", "Spaces", ["Notification"]),
        new("SessionPaid", "Spaces", ["Notification"]),
        new("SessionStarted", "Spaces", ["Sales", "Notification"]),
        new("ShiftClosed", "Sales", ["Branch"]),
        new("ShiftOpened", "Sales", ["Branch", "Payroll"]),
        new("StockConsumed", "Inventory", ["Finance"]),
        new("StockLow", "Inventory", ["Notification"]),
        new("TabPaymentRecorded", "Sales", ["Accounts"]),
        new("TicketRefunded", "Sales", ["Finance", "Loyalty", "Accounts"]),
        new("TicketSettled", "Sales", ["Finance", "Accounts"]),
        new("TicketUpdated", "Sales", ["Notification"]),
        new("TicketVoided", "Sales", ["Loyalty"]),
        new("UserProfileUpdated", "Identity", ["Loyalty", "Accounts"]),
    ];

    /// <summary>Routing keys: the CLR type names the services publish under.</summary>
    public static readonly string[] All = Catalog.Select(c => c.Name + Suffix).ToArray();

    /// <summary>Events a background service emits on its own timer; never a failure when seen.</summary>
    public static readonly string[] Tolerated = ["OrderReminder" + Suffix];

    /// <summary>Events the full day-in-the-life script must see at least once.</summary>
    public static readonly string[] ExpectedInFullDay =
    [
        "BranchSettingsChanged", "CashMoved", "CashPaidOut", "CatalogItemAvailabilityChanged", "CatalogItemStockChanged",
        "EmployeeEarningsChanged", "OrderCustomerAssigned", "OrderReadyChanged", "OrderStarted",
        "OrderStatusChangedToAwaitingValidation", "OrderStatusChangedToCancelled", "OrderStatusChangedToConfirmed",
        "OrderStatusChangedToSubmitted", "OrderStockConfirmed", "OrderStockRejected", "PurchaseReceived",
        "ReservationCancelled", "RoomBecameAvailable", "ServiceRequestCreated", "SessionCompleted", "SessionEnded",
        "SessionMemberJoined", "SessionStarted", "ShiftClosed", "ShiftOpened", "StockConsumed", "StockLow",
        "TabPaymentRecorded", "TicketRefunded", "TicketSettled", "TicketUpdated", "TicketVoided",
    ];

    /// <summary>Normalises "TicketSettled" and "TicketSettledIntegrationEvent" to the routing key.</summary>
    public static string Key(string name) => name.EndsWith(Suffix, StringComparison.Ordinal) ? name : name + Suffix;
}
