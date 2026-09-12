public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddDefaultAuthentication();

        // Avoid loading full database config and migrations if startup
        // is being invoked from build-time OpenAPI generation
        if (builder.Environment.IsBuild())
        {
            builder.Services.AddDbContext<CatalogContext>();
            return;
        }

        builder.AddNpgsqlDbContext<CatalogContext>("catalogdb");

        // REVIEW: This is done for development ease but shouldn't be here in production
        builder.Services.AddMigration<CatalogContext, CatalogContextSeed>();

        // Add the integration services that consume the DbContext
        builder.Services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<CatalogContext>>();

        builder.Services.AddTransient<ICatalogIntegrationEventService, CatalogIntegrationEventService>();

        builder.AddRabbitMqEventBus("eventbus")
               .AddSubscription<OrderStatusChangedToAwaitingValidationIntegrationEvent, OrderStatusChangedToAwaitingValidationIntegrationEventHandler>()
               .AddSubscription<OrderStatusChangedToPaidIntegrationEvent, OrderStatusChangedToPaidIntegrationEventHandler>()
               .AddSubscription<OrderConfirmedWithPreferencesIntegrationEvent, OrderConfirmedWithPreferencesIntegrationEventHandler>()
               .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderStatusChangedToConfirmedIntegrationEventHandler>()
               .AddSubscription<CatalogItemStockChangedIntegrationEvent, CatalogItemStockChangedIntegrationEventHandler>()
               .AddSubscription<CatalogOptionStockChangedIntegrationEvent, CatalogOptionStockChangedIntegrationEventHandler>();

        builder.Services.AddOptions<CatalogOptions>()
            .BindConfiguration(nameof(CatalogOptions));
    }
}
