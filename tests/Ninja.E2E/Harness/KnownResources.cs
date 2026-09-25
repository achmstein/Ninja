namespace Ninja.E2E.Harness;

/// <summary>
/// Resource names as declared in src/Ninja.AppHost/Program.cs, database
/// names, and each service's RabbitMQ queue (EventBus:SubscriptionClientName).
/// The guard tests keep these in step with the source.
/// </summary>
public static class KnownResources
{
    public const string Bff = "mobile-bff";
    public const string Keycloak = "keycloak";
    public const string EventBus = "eventbus";
    public const string Postgres = "postgres";

    public static readonly string[] Apis =
    [
        "catalog-api", "ordering-api", "spaces-api", "sales-api", "inventory-api", "payroll-api",
        "finance-api", "identity-api", "loyalty-api", "notification-api", "accounts-api", "tenant-api",
        // The owner's MCP server
        "assistant-api",
        // The platform's own control plane rides along in dry-run mode
        "control-api",
    ];

    public static readonly string[] Databases =
    [
        "accountsdb", "catalogdb", "orderingdb", "spacesdb", "salesdb", "inventorydb",
        "payrolldb", "financedb", "loyaltydb", "tenantdb", "notificationdb", "controldb",
    ];

    /// <summary>Databases whose context maps the IntegrationEventLog outbox table.</summary>
    public static readonly string[] OutboxDatabases =
    [
        "catalogdb", "financedb", "inventorydb", "orderingdb", "payrolldb", "salesdb", "spacesdb",
    ];

    public static readonly string[] Queues =
    [
        "Accounts", "Catalog", "Finance", "Identity", "Inventory",
        "Loyalty", "Notification", "Ordering", "Payroll", "Sales", "Spaces", "Tenant",
    ];
}
