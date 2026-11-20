#nullable enable
namespace Ninja.Inventory.API.Application.Queries;

/// <summary>What a branch uses of a stock item in a day, from what went out lately.</summary>
public static class DailyUse
{
    /// <summary>How far back use is looked at: long enough to even out a week's busy and quiet days.</summary>
    public static readonly TimeSpan Window = TimeSpan.FromDays(14);

    /// <summary>
    /// What went out, by the days it went out over: the window, or the days
    /// since the item first moved at the branch when that is less (never
    /// under one day). Null when nothing went out on balance.
    /// </summary>
    public static decimal? Of(decimal used, DateTime firstMovedAt, DateTime now)
    {
        if (used <= 0) return null;
        var days = Math.Clamp((now - firstMovedAt).TotalDays, 1, Window.TotalDays);
        return Math.Round(used / (decimal)days, 4);
    }
}
