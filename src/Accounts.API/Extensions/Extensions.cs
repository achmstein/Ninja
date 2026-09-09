using System.Text.Json.Serialization;
using Chillax.Accounts.API.Application.Queries;
using Chillax.Accounts.API.IntegrationEvents.Events;
using Chillax.Accounts.API.IntegrationEvents.EventHandling;
using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.Infrastructure;
using Chillax.Accounts.Infrastructure.Repositories;
using Chillax.ServiceDefaults;

namespace Chillax.Accounts.API.Extensions;

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
