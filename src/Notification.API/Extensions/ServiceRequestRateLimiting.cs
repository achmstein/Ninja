#nullable enable
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Chillax.Notification.API.Extensions;

/// <summary>
/// Rate limiting for service requests, the same shape as Ordering's for
/// orders: creating one is anonymous so a guest at a table can call a
/// waiter, which also makes it the one endpoint a stranger with a table's
/// link can use to ring the till. Signed-in customers are accountable
/// through their token and stay unlimited; everyone else gets a window wide
/// enough for a real table's evening and far too narrow to flood a floor.
/// </summary>
public static class ServiceRequestRateLimiting
{
    public const string GuestCreatePolicy = "guest-service-request-create";

    /// <summary>Requests one anonymous caller may send per <see cref="Window"/>.</summary>
    private const int GuestRequestsPerWindow = 10;

    /// <summary>
    /// Ceiling per address per <see cref="Window"/>, regardless of guest id:
    /// the per-guest limit partitions on a value the client chooses, so
    /// rotating ids would dodge it, while every rotation shares this bucket.
    /// </summary>
    private const int AnonymousRequestsPerWindowPerAddress = 60;

    private static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

    public static IServiceCollection AddServiceRequestRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                if (context.User.Identity?.IsAuthenticated == true
                    || !HttpMethods.IsPost(context.Request.Method)
                    || !context.Request.Path.StartsWithSegments("/api/notifications/service-requests"))
                {
                    return RateLimitPartition.GetNoLimiter("unlimited");
                }
                var address = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(
                    $"ip:{address}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = AnonymousRequestsPerWindowPerAddress,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });

            options.AddPolicy(GuestCreatePolicy, context =>
            {
                if (context.User.Identity?.IsAuthenticated == true)
                {
                    return RateLimitPartition.GetNoLimiter("authenticated");
                }
                var partitionKey = context.GetGuestId()
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = GuestRequestsPerWindow,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });
        });

        return services;
    }
}
