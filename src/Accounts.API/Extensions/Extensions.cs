using System.Text.Json.Serialization;
using Ninja.Accounts.API.Application.Queries;
using Ninja.Accounts.API.IntegrationEvents.Events;
using Ninja.Accounts.API.IntegrationEvents.EventHandling;
using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Ninja.Accounts.Infrastructure;
using Ninja.Accounts.Infrastructure.Repositories;
using Ninja.ServiceDefaults;

namespace Ninja.Accounts.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddDefaultAuthentication();

        if (builder.Environment.IsBuild())
        {
            builder.Services.AddDbContext<AccountsContext>();
            builder.Services.AddAuthentication();
            builder.Services.AddAuthorization();
            return;
        }

        builder.AddNpgsqlDbContext<AccountsContext>("accountsdb", configureDbContextOptions: options =>
        {
        });

        builder.Services.AddMigration<AccountsContext>();

        builder.Services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
            cfg.LicenseKey = builder.Configuration["MediatR:LicenseKey"];
        });

        builder.Services.AddScoped<ICustomerAccountRepository, CustomerAccountRepository>();
        builder.Services.AddScoped<IAccountQueries, AccountQueries>();

        builder.AddRabbitMqEventBus("eventbus")
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(AccountsIntegrationEventContext.Default))
            .AddSubscription<UserProfileUpdatedIntegrationEvent, UserProfileUpdatedIntegrationEventHandler>()
            .AddSubscription<TicketSettledIntegrationEvent, TicketSettledIntegrationEventHandler>()
            .AddSubscription<TicketRefundedIntegrationEvent, TicketRefundedIntegrationEventHandler>()
            .AddSubscription<TabPaymentRecordedIntegrationEvent, TabPaymentRecordedIntegrationEventHandler>();
    }
}

[JsonSerializable(typeof(UserProfileUpdatedIntegrationEvent))]
[JsonSerializable(typeof(TicketSettledIntegrationEvent))]
[JsonSerializable(typeof(TicketRefundedIntegrationEvent))]
[JsonSerializable(typeof(TabPaymentRecordedIntegrationEvent))]
partial class AccountsIntegrationEventContext : JsonSerializerContext
{
}
