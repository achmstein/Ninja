using System.Text.Json.Serialization;
using Ninja.Branch.API.IntegrationEvents;
using Ninja.Branch.API.IntegrationEvents.EventHandling;
using Ninja.Branch.API.Services;

namespace Ninja.Branch.API.Extensions;

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

        builder.Services.Configure<TenantStorageOptions>(builder.Configuration.GetSection("Storage"));
        builder.Services.AddSingleton<TenantBrandStore>();

        // The control plane's own token: client credentials of ninja-control, whose secret only the
        // control plane holds. azp names the client; a realm role would need every stamped realm changed.
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("Control", policy => policy.RequireAuthenticatedUser().RequireClaim("azp", "ninja-control"));

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
[JsonSerializable(typeof(TenantFeaturesChangedIntegrationEvent))]
[JsonSerializable(typeof(ShiftOpenedIntegrationEvent))]
[JsonSerializable(typeof(ShiftClosedIntegrationEvent))]
public partial class BranchIntegrationEventContext : JsonSerializerContext
{
}
