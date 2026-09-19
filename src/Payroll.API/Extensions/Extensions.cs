using System.Text.Json.Serialization;
using Ninja.Payroll.API.Application.IntegrationEvents.EventHandling;
using Ninja.Payroll.API.Application.IntegrationEvents.Events;
using Ninja.Payroll.API.Application.Queries;
using Ninja.Payroll.API.Application.Services;
using Ninja.Payroll.Infrastructure;
using Ninja.Payroll.Infrastructure.Idempotency;
using Ninja.Payroll.Infrastructure.Repositories;
using Ninja.EventBus.Extensions;

namespace Ninja.Payroll.API.Extensions;

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
            services.AddDbContext<PayrollContext>();
            return;
        }

        // Not pooled, for the same reason as Sales: the domain-event dispatch
        // needs the scoped context, and a pooled one gets a root mediator
        services.AddDbContext<PayrollContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("payrolldb")));
        builder.EnrichNpgsqlDbContext<PayrollContext>();

        // REVIEW: This is done for development ease but shouldn't be here in production
        services.AddMigration<PayrollContext>();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
            // Every command is one transaction; what it queues for the bus
            // goes out only after the commit
            cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
        });

        // The outbox, ready for Phase 2 (nothing is published yet)
        services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<PayrollContext>>();
        services.AddTransient<IPayrollIntegrationEventService, PayrollIntegrationEventService>();
        services.AddScoped<PayrollTransaction>();

        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<IAttendanceRepository, AttendanceRepository>();
        services.AddScoped<ILedgerRepository, LedgerRepository>();
        services.AddScoped<IPayslipRepository, PayslipRepository>();
        services.AddScoped<IPayslipGenerator, PayslipGenerator>();
        services.AddScoped<IRequestManager, RequestManager>();
        services.AddScoped<IPayrollQueries, PayrollQueries>();

        // What Payroll listens for: money the till handed to staff, and the
        // cashier opening the drawer (their attendance)
        builder.AddRabbitMqEventBus("eventbus")
            .AddSubscription<CashPaidOutIntegrationEvent, CashPaidOutIntegrationEventHandler>()
            .AddSubscription<ShiftOpenedIntegrationEvent, ShiftOpenedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(PayrollIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(CashPaidOutIntegrationEvent))]
[JsonSerializable(typeof(ShiftOpenedIntegrationEvent))]
[JsonSerializable(typeof(EmployeeEarningsChangedIntegrationEvent))]
public partial class PayrollIntegrationEventContext : JsonSerializerContext
{
}
