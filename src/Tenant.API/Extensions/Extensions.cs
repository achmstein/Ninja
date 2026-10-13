using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.IntegrationEvents.EventHandling;
using Ninja.Tenant.API.Services;
using Ninja.IntegrationEventLogEF;
using Ninja.IntegrationEventLogEF.Services;

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

        // The outbox: a change and its events saved together, sent straight after, and anything
        // left unsent (the bus down, the process gone) sent by the relay
        builder.Services.AddTransient<IIntegrationEventLogService, IntegrationEventLogService<TenantContext>>();
        builder.Services.AddOutboxRelay();
        builder.Services.AddScoped<TenantEvents>();
        builder.Services.AddScoped<BranchSettingsService>();
        // A shared map link is followed hop by hop, to Google hosts only (see MapLocation)
        builder.Services.AddMapLinkClient();
        builder.Services.AddSingleton<TenantCountry>();

        // Address search through Google Places with the platform's server key, cached and capped
        // per business; anonymous (guests check out), so each address is metered too
        builder.Services.AddPlacesClient(builder.Configuration);
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(Apis.PlacesApi.RateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 40, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

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

        // The business's own settings once at every start, after the migration
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
