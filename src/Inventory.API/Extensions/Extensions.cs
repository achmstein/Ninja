using System.Text.Json.Serialization;
using Chillax.Inventory.API.Application.IntegrationEvents.EventHandling;
using Chillax.Inventory.API.Application.IntegrationEvents.Events;
using Chillax.Inventory.API.Application.Queries;
using Chillax.Inventory.API.Application.Services;
using Chillax.Inventory.Infrastructure;
using Chillax.Inventory.Infrastructure.Idempotency;
using Chillax.Inventory.Infrastructure.Repositories;
using Chillax.EventBus.Extensions;

namespace Chillax.Inventory.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;

        builder.AddDefaultAuthentication();

        // Avoid loading full database config and migrations if startup
        // is being invoked from build-time OpenAPI generation
        if (builder.Environment.IsBuild())
        {
            services.AddDbContext<InventoryContext>();
            return;
        }

        // Not pooled, for the same reason as Sales: the domain-event dispatch
        // needs the scoped context, and a pooled one gets a root mediator
        services.AddDbContext<InventoryContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("inventorydb")));
        builder.EnrichNpgsqlDbContext<InventoryContext>();

        // REVIEW: This is done for development ease but shouldn't be here in production
        services.AddMigration<InventoryContext>();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
            // Every command is one transaction; what it queues for the bus
            // goes out only after the commit
            cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
        });

        // The outbox: sold-out and low-stock events are written with the
        // movements that caused them and published after the commit
        services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<InventoryContext>>();
        services.AddTransient<IInventoryIntegrationEventService, InventoryIntegrationEventService>();
        services.AddScoped<InventoryTransaction>();

        services.AddScoped<IStockItemRepository, StockItemRepository>();
        services.AddScoped<IRecipeRepository, RecipeRepository>();
        services.AddScoped<IPurchaseRepository, PurchaseRepository>();
        services.AddScoped<IStockCountRepository, StockCountRepository>();
        services.AddScoped<Chillax.Inventory.Domain.AggregatesModel.TransferAggregate.ITransferRepository, TransferRepository>();
        services.AddScoped<IStockLedger, StockLedger>();
        services.AddScoped<IStockPostingService, StockPostingService>();
        services.AddScoped<IRequestManager, RequestManager>();
        services.AddScoped<IInventoryQueries, InventoryQueries>();

        // Stock leaves when an order is confirmed; that is the only event
        // Inventory listens for
        builder.AddRabbitMqEventBus("eventbus")
            .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderStatusChangedToConfirmedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(InventoryIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(OrderStatusChangedToConfirmedIntegrationEvent))]
[JsonSerializable(typeof(CatalogItemStockChangedIntegrationEvent))]
[JsonSerializable(typeof(CatalogOptionStockChangedIntegrationEvent))]
[JsonSerializable(typeof(StockLowIntegrationEvent))]
[JsonSerializable(typeof(PurchaseReceivedIntegrationEvent))]
[JsonSerializable(typeof(StockConsumedIntegrationEvent))]
public partial class InventoryIntegrationEventContext : JsonSerializerContext
{
}
