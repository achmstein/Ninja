#nullable enable
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// The business's own delivery, as a module of Ordering: its numbers, the one
/// policy the app's and the till's orders are held to, the riders and the
/// board, its rate limits and its own word from Identity, wired here and
/// nowhere else. The rest of Ordering reaches it only through the Delivery
/// value object on an order, <see cref="IDeliveryPolicy"/> (and its draft),
/// <see cref="ICustomerAddressBook"/> and the step commands; the boundary test
/// in Ordering.UnitTests holds that line.
/// </summary>
public static class DeliveryModule
{
    /// <summary>The anonymous delivery quote: per device or address, plenty for a customer moving a pin.</summary>
    public const string QuotePolicy = "delivery-quote";

    /// <summary>A caller's earlier addresses, at the till: per staff account, enough for a busy phone line.</summary>
    public const string KnownAddressesPolicy = "delivery-known-addresses";

    private const int QuotesPerMinute = 60;
    private const int KnownAddressLookupsPerMinute = 30;

    public static IHostApplicationBuilder AddDeliveryModule(this IHostApplicationBuilder builder, IEventBusBuilder eventBus)
    {
        var services = builder.Services;

        services.Configure<DeliveryOptions>(builder.Configuration.GetSection(DeliveryOptions.Section));
        services.AddScoped<IDeliveryPolicy, DeliveryPolicy>();
        services.AddScoped<ICustomerAddressBook, CustomerAddressBook>();
        services.AddScoped<IRiderDirectory, RiderDirectory>();
        services.AddScoped<IDeliveryBoardQueries, DeliveryBoardQueries>();
        services.AddScoped<IRiderOverviewQueries, RiderOverviewQueries>();

        // The till reads a caller's shared short map link by following it: https, Google's hosts, a few hops
        services.AddMapLinkClient();

        // Beside Ordering's own limits (AddOrderRateLimiting): options compose
        services.Configure<RateLimiterOptions>(options =>
        {
            options.AddPolicy(QuotePolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst("sub")?.Value
                        ?? context.GetGuestId()
                        ?? context.Connection.RemoteIpAddress?.ToString()
                        ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = QuotesPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));

            options.AddPolicy(KnownAddressesPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = KnownAddressLookupsPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
        });

        // Identity's staff accounts: the riders among them, who the till may give a delivery to
        eventBus.AddSubscription<StaffAccountChangedIntegrationEvent, StaffAccountChangedIntegrationEventHandler>();

        return builder;
    }

    /// <summary>The module's endpoints, under the orders group (/api/orders/...).</summary>
    public static RouteGroupBuilder MapDeliveryModule(this RouteGroupBuilder orders) => orders.MapDeliveryRoutes();
}
