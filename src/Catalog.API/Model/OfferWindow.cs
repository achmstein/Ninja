namespace Ninja.Catalog.API.Model;

/// <summary>
/// When an offer applies: some weekdays (a bit per <see cref="DayOfWeek"/>,
/// none set meaning every day) between two times of day (both absent
/// meaning all day). A window that ends before it starts runs past
/// midnight and belongs to the day it started on.
/// </summary>
public static class OfferWindow
{
    public static bool Covers(int? weekdays, TimeOnly? from, TimeOnly? to, DateTime local)
    {
        var now = TimeOnly.FromDateTime(local);
        var timed = from is { } f && to is { } t && f != t;
        var crossesMidnight = timed && to!.Value < from!.Value;

        // 01:00 inside a 22:00–03:00 window is still the previous day's offer
        var day = crossesMidnight && now < to!.Value ? local.AddDays(-1).DayOfWeek : local.DayOfWeek;
        if (weekdays is > 0 && (weekdays.Value & (1 << (int)day)) == 0)
            return false;

        if (!timed)
            return true;

        return crossesMidnight
            ? now >= from!.Value || now < to!.Value
            : now >= from!.Value && now < to!.Value;
    }
}
