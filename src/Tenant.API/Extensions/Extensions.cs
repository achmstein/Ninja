using System.Text.Json.Serialization;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.IntegrationEvents.EventHandling;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.API.Extensions;

public static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<TenantContext>("tenantdb", configureDbContextOptions: options =>
        {
            options.UseNpgsql(builder => builder.MigrationsAssembly(typeof(TenantContext).Assembly.FullName));
        });

        builder.Services.AddMigration<TenantContext, TenantContextSeed>();

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
                options.TypeInfoResolverChain.Add(TenantIntegrationEventContext.Default));

        // The café's own settings once at every start, after the migration
        // above has made sure the tenant row is there
        builder.Services.AddHostedService<TenantSettingsAnnouncer>();
    }
}

[JsonSerializable(typeof(BranchSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(TenantFeaturesChangedIntegrationEvent))]
[JsonSerializable(typeof(TenantSettingsChangedIntegrationEvent))]
[JsonSerializable(typeof(ShiftOpenedIntegrationEvent))]
[JsonSerializable(typeof(ShiftClosedIntegrationEvent))]
public partial class TenantIntegrationEventContext : JsonSerializerContext
{
}
