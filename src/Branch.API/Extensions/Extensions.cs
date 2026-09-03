using System.Text.Json.Serialization;
using Chillax.Branch.API.IntegrationEvents;
using Chillax.Branch.API.IntegrationEvents.EventHandling;
using Chillax.Branch.API.Services;

namespace Chillax.Branch.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<BranchContext>("branchdb", configureDbContextOptions: options =>
        {
            options.UseNpgsql(builder => builder.MigrationsAssembly(typeof(BranchContext).Assembly.FullName));
        });

        builder.Services.AddMigration<BranchContext, BranchContextSeed>();

        builder.Services.AddScoped<BranchSettingsService>();

        // The shift drives the flags: opening the drawer turns ordering and
        // reservations on, closing it turns both off
        builder.AddRabbitMqEventBus("eventbus")
            .AddSubscription<ShiftOpenedIntegrationEvent, ShiftOpenedIntegrationEventHandler>()
            .AddSubscription<ShiftClosedIntegrationEvent, ShiftClosedIntegrationEventHandler>()
            .ConfigureJsonOptions(options =>
                options.TypeInfoResolverChain.Add(BranchIntegrationEventContext.Default));
    }
}

[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(ShiftOpenedIntegrationEvent))]
[JsonSerializable(typeof(ShiftClosedIntegrationEvent))]
public partial class BranchIntegrationEventContext : JsonSerializerContext
{
}
