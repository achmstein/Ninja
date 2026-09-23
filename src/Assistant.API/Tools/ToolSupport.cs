using System.Globalization;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>What the period tools share: resolve, fan out per branch, format the query.</summary>
internal static class ToolSupport
{
    public const string PeriodDescription = "Named period: today, yesterday, this_week, last_week, this_month, last_month, last_7_days, last_30_days, this_year. Ignored when from/to are given. Days are the cafe's business days in its own time zone.";
    public const string FromDescription = "First day, yyyy-MM-dd (inclusive). With 'to' omitted, just that day.";
    public const string ToDescription = "Last day, yyyy-MM-dd (inclusive).";
    public const string BranchDescription = "Branch id or name (English or Arabic). Omit for every active branch: the answer then has a total plus a line per branch.";
    public const string TopDescription = "How many rows to keep in each list (1-50).";

    public static ApiResult<Period> Period(TenantSnapshot snapshot, BranchResponse branch, string? period, string? from, string? to, DateTimeOffset nowUtc)
    {
        try
        {
            return ApiResult<Period>.Ok(PeriodResolver.Resolve(period, from, to, snapshot.Zone, branch.DayStart, nowUtc, snapshot.WeekStart));
        }
        catch (PeriodException ex)
        {
            return ApiResult<Period>.Fail(ex.Message, null);
        }
    }

    /// <summary>Resolves the period for each branch (its own day start) and fetches one report per branch.</summary>
    public static Task<FanOutResult<(Period Period, T Value)>> PerBranchWithPeriodAsync<T>(
        TenantSnapshot snapshot,
        IReadOnlyList<BranchResponse> branches,
        string? period, string? from, string? to, DateTimeOffset nowUtc,
        Func<BranchResponse, Period, Task<ApiResult<T>>> fetch)
        => FanOut.PerBranchAsync(branches, async branch =>
        {
            var p = Period(snapshot, branch, period, from, to, nowUtc);
            if (!p.IsOk)
                return ApiResult<(Period, T)>.Fail(p.Error!, null);
            var r = await fetch(branch, p.Value!);
            return r.IsOk ? ApiResult<(Period, T)>.Ok((p.Value!, r.Value!)) : ApiResult<(Period, T)>.Fail(r.Error!, r.Status);
        });

    /// <summary>The UTC instant as the reports' DateTime binder reads it.</summary>
    public static string Utc(DateTime utc) => utc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);

    public static string Day(DateOnly day) => day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static object? Errors(FanOutResult<(Period, object)> fan) => fan.Errors.Count == 0 ? null : fan.Errors;

    public static List<string>? ErrorsOrNull(List<string> errors) => errors.Count == 0 ? null : errors;

    public static string WeekdayName(int weekday) => weekday is >= 0 and <= 6 ? ((DayOfWeek)weekday).ToString() : weekday.ToString(CultureInfo.InvariantCulture);
}
