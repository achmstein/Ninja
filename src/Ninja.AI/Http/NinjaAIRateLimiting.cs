using System.Threading.RateLimiting;
using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Ninja.AI.Http;

/// <summary>
/// Rate limiting for the assistant's endpoints, in the shape of Ordering's
/// OrderRateLimiting. A free-tier key allows about ten calls a minute for
/// every service together, so each service keeps its own budget and each
/// signed-in user a slice of it; anything over answers 429 at once instead
/// of queueing behind a model call.
/// </summary>
public static class NinjaAIRateLimiting
{
    public const string PolicyName = "ai-assist";

    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public static IServiceCollection AddNinjaAIRateLimiting(this IServiceCollection services, int requestsPerMinute, int perUserRequestsPerMinute)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // The service-wide budget: every request carrying the assist policy shares one window
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var policy = context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
                if (policy != PolicyName)
                {
                    return RateLimitPartition.GetNoLimiter("unlimited");
                }

                return RateLimitPartition.GetFixedWindowLimiter(
                    "ai-service",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = requestsPerMinute,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });

            // One person's slice, keyed on their subject; unauthenticated callers never get this far (401 first)
            options.AddPolicy(PolicyName, context =>
            {
                var who = context.User.GetUserId() ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(
                    $"ai-user:{who}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = perUserRequestsPerMinute,
                        Window = Window,
                        QueueLimit = 0,
                    });
            });

            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.Headers.RetryAfter = "60";
                await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "AI assistant busy",
                    Detail = "Too many assistant requests; try again in a minute.",
                }, ct);
            };
        });

        return services;
    }
}
