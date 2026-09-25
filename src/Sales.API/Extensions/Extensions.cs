using System.Text.Json.Serialization;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Idempotency;
using Ninja.Sales.Infrastructure.Repositories;
using Ninja.EventBus.Extensions;

namespace Ninja.Sales.API.Extensions;

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
            services.AddDbContext<SalesContext>();
            return;
        }

        // Not pooled: Aspire's AddNpgsqlDbContext registers a pooled context, and a pooled
        // context gets its IMediator from the root provider. The domain-event handlers
        // need the scoped SalesContext (outbox), so dispatching from a root mediator
        // throws. Same registration as Ordering.
        services.AddDbContext<SalesContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("salesdb")));
        builder.EnrichNpgsqlDbContext<SalesContext>();

        // REVIEW: This is done for development ease but shouldn't be here in production
        services.AddMigration<SalesContext>();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
            // Every command is one transaction; what it queues for the bus
            // goes out only after the commit
            cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
        });

        // The outbox: events are written with the rows that produced them and
        // published after the commit — a crash in between loses nothing. The
        // bus handlers that assemble tickets run through the same
        // SalesTransaction the command behavior uses.
        services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<SalesContext>>();
        services.AddTransient<ISalesIntegrationEventService, SalesIntegrationEventService>();
        services.AddScoped<SalesTransaction>();

        services.AddScoped<ITicketRepository, TicketRepository>();
        services.AddScoped<Ninja.Sales.Domain.AggregatesModel.ShiftAggregate.IShiftRepository, ShiftRepository>();
        services.AddScoped<Ninja.Sales.Domain.AggregatesModel.TabPaymentAggregate.ITabPaymentRepository, TabPaymentRepository>();
        services.AddScoped<IRequestManager, RequestManager>();
        services.AddScoped<ITicketQueries, TicketQueries>();
        services.AddScoped<IShiftQueries, ShiftQueries>();
        services.AddScoped<ITenantFeaturesQueries, TenantFeaturesQueries>();

        // Tickets are assembled from the bus and announce themselves back on it
        builder.AddRabbitMqEventBus("eventbus")
            .AddSubscription<SessionStartedIntegrationEvent, SessionStartedIntegrationEventHandler>()
            // Who sat in the room: they may read the receipt later
            .AddSubscription<SessionMemberJoinedIntegrationEvent, SessionMemberJoinedIntegrationEventHandler>()
            .AddSubscription<SessionCustomerAssignedIntegrationEvent, SessionCustomerAssignedIntegrationEventHandler>()
            .AddSubscription<SessionCompletedIntegrationEvent, SessionCompletedIntegrationEventHandler>()
            .AddSubscription<ReservationCancelledIntegrationEvent, ReservationCancelledIntegrationEventHandler>()
            .AddSubscription<OrderStatusChangedToConfirmedIntegrationEvent, OrderStatusChangedToConfirmedIntegrationEventHandler>()
            .AddSubscription<OrderCustomerAssignedIntegrationEvent, OrderCustomerAssignedIntegrationEventHandler>()
            // Whether guests may pay at the table: Sales keeps its own copy of the switch
            .AddSubscription<TenantFeaturesChangedIntegrationEvent, TenantFeaturesChangedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(SalesIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(SessionStartedIntegrationEvent))]
[JsonSerializable(typeof(SessionMemberJoinedIntegrationEvent))]
[JsonSerializable(typeof(SessionCustomerAssignedIntegrationEvent))]
[JsonSerializable(typeof(SessionCompletedIntegrationEvent))]
[JsonSerializable(typeof(OrderStatusChangedToConfirmedIntegrationEvent))]
[JsonSerializable(typeof(OrderCustomerAssignedIntegrationEvent))]
[JsonSerializable(typeof(TenantFeaturesChangedIntegrationEvent))]
[JsonSerializable(typeof(TicketUpdatedIntegrationEvent))]
[JsonSerializable(typeof(TicketSettledIntegrationEvent))]
[JsonSerializable(typeof(TicketVoidedIntegrationEvent))]
[JsonSerializable(typeof(TicketRefundedIntegrationEvent))]
[JsonSerializable(typeof(TabPaymentRecordedIntegrationEvent))]
[JsonSerializable(typeof(ShiftOpenedIntegrationEvent))]
[JsonSerializable(typeof(ShiftClosedIntegrationEvent))]
[JsonSerializable(typeof(CashPaidOutIntegrationEvent))]
[JsonSerializable(typeof(CashMovedIntegrationEvent))]
public partial class SalesIntegrationEventContext : JsonSerializerContext
{
}
