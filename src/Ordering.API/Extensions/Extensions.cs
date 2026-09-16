using FluentValidation;

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

        services.AddTransient<IOrderingIntegrationEventService, OrderingIntegrationEventService>();

        builder.AddRabbitMqEventBus("eventbus")
               .AddEventBusSubscriptions();

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

        services.AddScoped<IOrderQueries, OrderQueries>();
        services.AddScoped<IBranchSettingsQueries, BranchSettingsQueries>();
        services.AddScoped<IBuyerRepository, BuyerRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IRequestManager, RequestManager>();

        // Background service for pending order reminders
        services.AddHostedService<Chillax.Ordering.API.BackgroundServices.PendingOrderReminderService>();
    }

    private static void AddEventBusSubscriptions(this IEventBusBuilder eventBus)
    {
        // Subscribe to stock validation events from Catalog API
        eventBus.AddSubscription<OrderStockConfirmedIntegrationEvent, OrderStockConfirmedIntegrationEventHandler>();
        eventBus.AddSubscription<OrderStockRejectedIntegrationEvent, OrderStockRejectedIntegrationEventHandler>();

        // Branch.API's flags, projected locally so a paused branch refuses
        // customer orders without a call across services
        eventBus.AddSubscription<BranchSettingsChangedIntegrationEvent, BranchSettingsChangedIntegrationEventHandler>();

        // Sales' receipts, projected onto the orders they covered: "paid" and
        // "refunded" reach the customer's list without a call to Sales
        eventBus.AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>();
        eventBus.AddSubscription<TicketRefundedIntegrationEvent, TicketRefundedIntegrationEventHandler>();
        eventBus.AddSubscription<TicketVoidedIntegrationEvent, TicketVoidedIntegrationEventHandler>();
    }
}
