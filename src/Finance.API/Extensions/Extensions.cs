using System.Text.Json.Serialization;
using Ninja.AI;
using Ninja.Finance.API.Application.Assist;
using Ninja.Finance.API.Application.IntegrationEvents.EventHandling;
using Ninja.Finance.API.Application.IntegrationEvents.Events;
using Ninja.Finance.API.Application.Queries;
using Ninja.Finance.API.Application.Services;
using Ninja.Finance.Infrastructure;
using Ninja.Finance.Infrastructure.Idempotency;
using Ninja.Finance.Infrastructure.Repositories;
using Ninja.EventBus.Extensions;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ninja.Finance.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;

        builder.AddDefaultAuthentication();

        // The assistant: on when the AppHost handed out a chat model, scripted
        // under test, off otherwise. Before the build-time guard because the
        // rate limiter middleware needs its services even when only the
        // OpenAPI document is being generated.
        builder.AddAIServices();
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<BillScanner>();
        services.AddFakeAgentScript(BillScanner.AgentKey, BillScannerFake.Respond);

        // Avoid loading full database config and migrations if startup
        // is being invoked from build-time OpenAPI generation
        if (builder.Environment.IsBuild())
        {
            services.AddDbContext<FinanceContext>();
            return;
        }

        // Not pooled, for the same reason as Sales: the domain-event dispatch
        // needs the scoped context, and a pooled one gets a root mediator
        services.AddDbContext<FinanceContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("financedb")));
        builder.EnrichNpgsqlDbContext<FinanceContext>();

        // REVIEW: This is done for development ease but shouldn't be here in production
        services.AddMigration<FinanceContext, FinanceContextSeed>();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
            // Every command is one transaction; what it queues for the bus
            // goes out only after the commit
            cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
        });

        // The outbox: nothing leaves Finance yet; it is here so that when
        // something does, it is never fire-and-forget
        services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<FinanceContext>>();
        services.AddTransient<IFinanceIntegrationEventService, FinanceIntegrationEventService>();
        services.AddScoped<FinanceTransaction>();

        services.AddScoped<IExpenseRepository, ExpenseRepository>();
        services.AddScoped<IExpenseCategoryRepository, ExpenseCategoryRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IPartnerRepository, PartnerRepository>();
        services.AddScoped<IProfitRepository, ProfitRepository>();
        services.AddScoped<IRecurringExpenseRepository, RecurringExpenseRepository>();
        services.AddScoped<IRecurringExpensePoster, RecurringExpensePoster>();
        // Rent on the 1st, internet on the 5th: posted by the hour, once a month each
        services.AddHostedService<RecurringExpensesJob>();
        services.AddScoped<IRequestManager, RequestManager>();
        services.AddScoped<IFinanceQueries, FinanceQueries>();

        // What Finance listens for: money the till moved for a supplier, an
        // expense or a partner, and deliveries Inventory booked
        builder.AddRabbitMqEventBus("eventbus")
            .AddSubscription<CashMovedIntegrationEvent, CashMovedIntegrationEventHandler>()
            .AddSubscription<PurchaseReceivedIntegrationEvent, PurchaseReceivedIntegrationEventHandler>()
            // The profit projection's feeds: the till, the storeroom, payroll
            .AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>()
            .AddSubscription<TicketRefundedIntegrationEvent, TicketRefundedIntegrationEventHandler>()
            .AddSubscription<StockConsumedIntegrationEvent, StockConsumedIntegrationEventHandler>()
            .AddSubscription<EmployeeEarningsChangedIntegrationEvent, EmployeeEarningsChangedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(FinanceIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(CashMovedIntegrationEvent))]
[JsonSerializable(typeof(PurchaseReceivedIntegrationEvent))]
[JsonSerializable(typeof(TicketSettledIntegrationEvent))]
[JsonSerializable(typeof(TicketRefundedIntegrationEvent))]
[JsonSerializable(typeof(StockConsumedIntegrationEvent))]
[JsonSerializable(typeof(EmployeeEarningsChangedIntegrationEvent))]
public partial class FinanceIntegrationEventContext : JsonSerializerContext
{
}
