using Ninja.ServiceDefaults;
using FluentValidation;
using Ninja.IntegrationEventLogEF;

internal static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;
        
        // Add the authentication services to DI
        builder.AddDefaultAuthentication();

        // Guest checkout leaves order creation open to anonymous callers
        services.AddOrderRateLimiting();

        // Pooling is disabled because of the following error:
        // Unhandled exception. System.InvalidOperationException:
        // The DbContext of type 'OrderingContext' cannot be pooled because it does not have a public constructor accepting a single parameter of type DbContextOptions or has more than one constructor.
        services.AddDbContext<OrderingContext>(options =>
        {
            options.UseNpgsql(builder.Configuration.GetConnectionString("orderingdb"));
        });
        builder.EnrichNpgsqlDbContext<OrderingContext>();

        services.AddMigration<OrderingContext, OrderingContextSeed>();

        // Add the integration services that consume the DbContext
        services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<OrderingContext>>();
        // An order whose check was saved but never sent would wait forever
        services.AddOutboxRelay();

        services.AddTransient<IOrderingIntegrationEventService, OrderingIntegrationEventService>();

        var eventBus = builder.AddRabbitMqEventBus("eventbus");
        eventBus.AddEventBusSubscriptions();

        services.AddHttpContextAccessor();
        services.AddTransient<IIdentityService, IdentityService>();

        // Configure mediatR
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));

            cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
            cfg.AddOpenBehavior(typeof(ValidatorBehavior<,>));
            cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));

            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
        });

        // Register the command validators for the validator behavior (validators based on FluentValidation library)
        services.AddValidatorsFromAssemblyContaining<CancelOrderCommandValidator>();

        // Where the business is: a phone number is read the way its country writes one
        services.AddSingleton<TenantCountry>();
        services.AddScoped<IOrderQueries, OrderQueries>();
        services.AddScoped<IBranchSettingsQueries, BranchSettingsQueries>();
        services.AddScoped<ITenantSettingsQueries, TenantSettingsQueries>();
        services.AddScoped<IPlaceQueries, PlaceQueries>();
        services.AddScoped<IBuyerRepository, BuyerRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IKitchenQueries, KitchenQueries>();
        services.AddScoped<IKitchenStationRepository, KitchenStationRepository>();
        services.AddScoped<IKitchenPrintJobRepository, KitchenPrintJobRepository>();
        services.AddScoped<IPrintConnectorRepository, PrintConnectorRepository>();
        services.AddScoped<IRequestManager, RequestManager>();

        // The business's switches, cached between the events that change them
        services.AddMemoryCache();

        // The business's own delivery: a module of its own (Deliveries/DeliveryModule.cs)
        builder.AddDeliveryModule(eventBus);

        // Background service for pending order reminders
        services.AddHostedService<Ninja.Ordering.API.BackgroundServices.PendingOrderReminderService>();
        // Orders paid ahead that were not paid in time are cancelled
        // Orders paid ahead: how long the branch has to accept one once it is paid
        services.Configure<PayAheadOptions>(builder.Configuration.GetSection("PayAhead"));
        services.AddHostedService<Ninja.Ordering.API.BackgroundServices.UnpaidOrderSweeper>();

        // Talabat: the platform relays its orders here with its own token, and
        // passes what the business does with them back through the relay
        services.AddAuthorizationBuilder()
            .AddPolicy("Control", policy => policy.RequireAuthenticatedUser().RequireClaim("azp", "ninja-control"));
        services.Configure<Ninja.Ordering.API.Talabat.TalabatOptions>(builder.Configuration.GetSection(Ninja.Ordering.API.Talabat.TalabatOptions.Section));
        services.AddHttpClient(Ninja.Ordering.API.Talabat.PlatformUpdateSender.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(20));
        services.AddHostedService<Ninja.Ordering.API.Talabat.PlatformUpdateSender>();
    }

    private static void AddEventBusSubscriptions(this IEventBusBuilder eventBus)
    {
        // Catalog's answer to the order check: every line priced, or why not
        eventBus.AddSubscription<OrderValidatedIntegrationEvent, OrderValidatedIntegrationEventHandler>();
        eventBus.AddSubscription<OrderValidationFailedIntegrationEvent, OrderValidationFailedIntegrationEventHandler>();
        // The same answers under their names from before prices, kept one
        // release for those queued when the stack was upgraded
        eventBus.AddSubscription<OrderStockConfirmedIntegrationEvent, OrderStockConfirmedIntegrationEventHandler>();
        eventBus.AddSubscription<OrderStockRejectedIntegrationEvent, OrderStockRejectedIntegrationEventHandler>();

        // Tenant.API's flags, projected locally so a paused branch refuses
        // customer orders without a call across services
        eventBus.AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>();

        // The business's own settings, the same way: one row that every branch reads
        eventBus.AddSubscription<TenantSettingsChangedIntegrationEvent, TenantSettingsChangedIntegrationEventHandler>();

        // The business's switches: whether it delivers at all (bought, and on)
        eventBus.AddSubscription<TenantFeaturesChangedIntegrationEvent, TenantFeaturesChangedIntegrationEventHandler>();

        // Spaces' places, projected locally: an order names a place and a
        // deactivated one is refused without a call across services
        eventBus.AddSubscription<PlaceUpdatedIntegrationEvent, PlaceUpdatedIntegrationEventHandler>();

        // Sales' receipts, projected onto the orders they covered: "paid" and
        // "refunded" reach the customer's list without a call to Sales
        eventBus.AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>();
        eventBus.AddSubscription<TicketRefundedIntegrationEvent, TicketRefundedIntegrationEventHandler>();
        eventBus.AddSubscription<TicketVoidedIntegrationEvent, TicketVoidedIntegrationEventHandler>();

        // An order paid ahead online: Sales took the customer's payment, and the order goes to the till
        eventBus.AddSubscription<OrderPaidOnlineIntegrationEvent, OrderPaidOnlineIntegrationEventHandler>();
    }
}
