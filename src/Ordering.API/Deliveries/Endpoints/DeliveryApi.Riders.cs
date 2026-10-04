#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>The admin's Riders page: the branch's riders now, and each one's deliveries over time.</summary>
public static partial class DeliveryApi
{
    /// <summary>The widest a time-zone offset reaches (UTC−14 to UTC+12), in minutes.</summary>
    private const int MaxTzOffsetMinutes = 14 * 60;

    public static async Task<Results<Ok<List<RiderOverview>>, ProblemHttpResult>> GetRidersOverviewAsync(
        HttpContext httpContext,
        IRiderOverviewQueries riders,
        int tzOffsetMinutes = 0)
    {
        if (Math.Abs(tzOffsetMinutes) > MaxTzOffsetMinutes)
        {
            return OrderingProblems.Of(RiderHistoryErrors.TimeZoneInvalid, "The time-zone offset is not one a clock can have.");
        }

        return TypedResults.Ok(await riders.GetOverviewAsync(httpContext.GetRequiredBranchId(), tzOffsetMinutes));
    }

    public static async Task<Results<Ok<RiderDeliveryHistory>, ProblemHttpResult>> GetRiderDeliveriesAsync(
        string userId,
        HttpContext httpContext,
        IRiderOverviewQueries riders,
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = RiderHistoryErrors.DefaultPageSize)
    {
        // Instants: the admin sends the window's edges in UTC; by default the last week
        var until = (to ?? DateTime.UtcNow).ToUniversalTime();
        var since = (from ?? until.AddDays(-7)).ToUniversalTime();
        if (since >= until)
        {
            return OrderingProblems.Of(RiderHistoryErrors.RangeInvalid, "The window must start before it ends.");
        }

        if (until - since > RiderHistoryErrors.MaxRange)
        {
            return OrderingProblems.Of(RiderHistoryErrors.RangeInvalid, $"A window can cover {RiderHistoryErrors.MaxRange.TotalDays:0} days at most.");
        }

        var size = Math.Clamp(pageSize, 1, RiderHistoryErrors.MaxPageSize);
        var number = Math.Max(1, page);
        return TypedResults.Ok(await riders.GetHistoryAsync(httpContext.GetRequiredBranchId(), userId, since, until, number, size));
    }

    public static async Task<Results<Ok<List<DeliveryTimelineStep>>, NotFound>> GetDeliveryTimelineAsync(
        int orderId,
        HttpContext httpContext,
        IRiderOverviewQueries riders)
    {
        // Another branch's delivery is as good as missing
        var steps = await riders.GetTimelineAsync(httpContext.GetRequiredBranchId(), orderId);
        return steps is null ? TypedResults.NotFound() : TypedResults.Ok(steps);
    }
}
