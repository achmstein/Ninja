#nullable enable
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Ninja.Ordering.API.Deliveries;

using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

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

    /// <summary>A connected courier company's status calls, signed but not signed in: per company, generous for a busy one.</summary>
    public const string CourierStatusPolicy = "courier-status";

    private const int QuotesPerMinute = 60;
    private const int CourierStatusesPerMinute = 600;
    private const int KnownAddressLookupsPerMinute = 30;

    /// <summary>
    /// The numbers the module keeps (a delivery's, a saved address's) written the old local way, put in
    /// the one form numbers are kept in now, so a caller's earlier deliveries are still found by the
    /// number as it is read today. Run at start, after the migrations; repeat-safe.
    /// </summary>
    public static async Task<int> KeepPhonesInOneFormAsync(OrderingContext context, string country)
    {
        var customer = PhoneColumns.Customer(country);
        return await context.KeepPhonesInOneFormAsync<DomainOrder>(nameof(Delivery.Phone), customer, owned: nameof(DomainOrder.Delivery))
            + await context.KeepPhonesInOneFormAsync<CustomerAddress>(nameof(CustomerAddress.Phone), customer);
    }

    public static IHostApplicationBuilder AddDeliveryModule(this IHostApplicationBuilder builder, IEventBusBuilder eventBus)
    {
        var services = builder.Services;

        services.Configure<DeliveryOptions>(builder.Configuration.GetSection(DeliveryOptions.Section));
        services.AddScoped<IDeliveryPolicy, DeliveryPolicy>();
        services.AddScoped<ICustomerAddressBook, CustomerAddressBook>();
        services.AddScoped<IRiderDirectory, RiderDirectory>();
        services.AddScoped<IDeliveryBoardQueries, DeliveryBoardQueries>();
        services.AddScoped<IRiderOverviewQueries, RiderOverviewQueries>();

        // Connected courier companies: their secrets sealed with the stack's key, their jobs sent and their status taken
        services.Configure<CourierOptions>(builder.Configuration.GetSection(CourierOptions.Section));
        services.AddSingleton<CourierSecrets>();
        services.AddScoped<ICourierDispatch, CourierDispatch>();
        services.AddScoped<CourierStatusReceiver>();
        services.AddSingleton<CourierCallLog>();
        services.AddHostedService<CourierCancelSender>();
        // Not the shared retries: the till hears at once when a company does not take a job, and a cancel has its own
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is marked experimental, as in Control.API
        services.AddHttpClient(CourierDispatch.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(15))
            .RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

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

            options.AddPolicy(CourierStatusPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    $"courier:{context.Request.RouteValues["providerId"]}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = CourierStatusesPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
        });

        // Identity's staff accounts: the riders among them, who the till may give a delivery to
        eventBus.AddSubscription<StaffAccountChangedIntegrationEvent, StaffAccountChangedIntegrationEventHandler>();

        return builder;
    }

    /// <summary>The module's endpoints, under the orders group (/api/orders/...).</summary>
    public static RouteGroupBuilder MapDeliveryModule(this RouteGroupBuilder orders) => orders.MapDeliveryRoutes().MapCourierRoutes();
}
