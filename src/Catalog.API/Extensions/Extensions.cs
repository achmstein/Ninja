using Ninja.AI;
using Ninja.Catalog.API.Assist;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        TenantClock.Configure(builder.Configuration["Tenant:TimeZone"]);
        builder.AddDefaultAuthentication();

        // The platform's own token (ninja-control), for what it relays from Talabat
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("Control", policy => policy.RequireAuthenticatedUser().RequireClaim("azp", "ninja-control"))
            .AddPolicy("OwnerOrControl", policy => policy.RequireAssertion(c => c.User.IsInRole("Owner") || c.User.HasClaim("azp", "ninja-control")));

        // The assistant: on when the AppHost handed out a chat model, scripted
        // under test, off otherwise. Before the build-time guard because the
        // rate limiter middleware needs its services even when only the
        // OpenAPI document is being generated.
        builder.AddAIServices();
        builder.Services.AddSingleton<MenuLocalizer>();
        builder.Services.AddFakeAgentScript(MenuLocalizer.AgentKey, MenuLocalizerFake.Respond);
        builder.Services.AddSingleton<CustomizationSuggester>();
        builder.Services.AddFakeAgentScript(CustomizationSuggester.AgentKey, CustomizationSuggesterFake.Respond);
        builder.Services.AddSingleton<MenuScanner>();
        builder.Services.AddFakeAgentScript(MenuScanner.AgentKey, MenuScannerFake.Respond);
        builder.Services.AddFakeAgentScript(MenuScanner.OrdererKey, MenuScannerFake.RespondOrder);

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
        // An answer to an order check that was saved but never sent would leave the order waiting
        builder.Services.AddOutboxRelay();

        builder.Services.AddTransient<ICatalogIntegrationEventService, CatalogIntegrationEventService>();

        builder.AddRabbitMqEventBus("eventbus")
               .AddSubscription<OrderStatusChangedToAwaitingValidationIntegrationEvent, OrderStatusChangedToAwaitingValidationIntegrationEventHandler>()
               .AddSubscription<OrderStatusChangedToPaidIntegrationEvent, OrderStatusChangedToPaidIntegrationEventHandler>()
               .AddSubscription<OrderConfirmedWithPreferencesIntegrationEvent, OrderConfirmedWithPreferencesIntegrationEventHandler>()
               .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderStatusChangedToConfirmedIntegrationEventHandler>()
               .AddSubscription<CatalogItemStockChangedIntegrationEvent, CatalogItemStockChangedIntegrationEventHandler>()
               .AddSubscription<CatalogOptionStockChangedIntegrationEvent, CatalogOptionStockChangedIntegrationEventHandler>()
               // A branch paused or opened here closes or opens it on Talabat
               .AddSubscription<Ninja.Catalog.API.Talabat.BranchSettingsChangedIntegrationEvent, Ninja.Catalog.API.Talabat.BranchSettingsChangedIntegrationEventHandler>();

        builder.Services.AddOptions<CatalogOptions>()
            .BindConfiguration(nameof(CatalogOptions));

        // Talabat: the menu and what is sold out go out through the platform's relay
        builder.Services.AddOptions<Ninja.Catalog.API.Talabat.TalabatOptions>().BindConfiguration(Ninja.Catalog.API.Talabat.TalabatOptions.Section);
        builder.Services.AddHttpClient(Ninja.Catalog.API.Talabat.TalabatSyncService.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(60));
        builder.Services.AddHostedService<Ninja.Catalog.API.Talabat.TalabatSyncService>();
    }
}
