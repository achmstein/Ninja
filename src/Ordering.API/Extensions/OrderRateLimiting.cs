#nullable enable
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Ninja.Ordering.API.Extensions;

/// <summary>
/// Rate limiting for order creation.
///
/// Placing an order is anonymous so guests can check out, which also makes it
/// the one endpoint a stranger can use to push tickets at the kitchen. Signed-in
/// customers are already accountable through their token and stay unlimited;
/// everyone else gets a window generous enough for a real table ordering several
/// rounds, and far too small to flood a branch.
/// </summary>
public static class OrderRateLimiting
{
    public const string GuestCreatePolicy = "guest-order-create";

    /// <summary>Orders one anonymous caller may place per <see cref="Window"/>.</summary>
    private const int GuestOrdersPerWindow = 10;

    /// <summary>
    /// Ceiling on anonymous order creation per address per <see cref="Window"/>,
    /// regardless of guest id. The per-guest limit partitions on a value the
    /// client chooses, so rotating ids would dodge it; every rotation still
    /// shares this bucket. Sized for a full café behind one NAT'd wifi IP —
    /// generous for real service, far too small to flood a kitchen.
    /// </summary>
    private const int AnonymousOrdersPerWindowPerAddress = 60;

    private static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

    public static IServiceCollection AddOrderRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Outer per-IP ceiling over the same requests the per-guest policy
            // governs; signed-in traffic and everything else passes untouched
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                if (context.User.Identity?.IsAuthenticated == true
                    || !HttpMethods.IsPost(context.Request.Method)
                    || !context.Request.Path.StartsWithSegments("/api/orders"))
                {
                    return RateLimitPartition.GetNoLimiter("unlimited");
                }

                var address = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                return RateLimitPartition.GetFixedWindowLimiter(
                    $"ip:{address}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = AnonymousOrdersPerWindowPerAddress,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });

            options.AddPolicy(GuestCreatePolicy, context =>
            {
                // Signed in: the token is the accountability, no limit needed
                if (context.User.Identity?.IsAuthenticated == true)
                {
                    return RateLimitPartition.GetNoLimiter("authenticated");
                }

                // Partition per guest device where we have one, falling back to
                // the remote address so a caller that omits the header cannot
                // dodge the limit by simply not identifying itself.
                var partitionKey = context.GetGuestId()
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown";

                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = GuestOrdersPerWindow,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });
        });

        return services;
    }
}
