using System.Globalization;

namespace Ninja.Assistant.API.Context;

/// <summary>A span of business days and the UTC window they cover.</summary>
public sealed record Period(string Label, DateOnly FromDate, DateOnly ToDate, DateTime FromUtc, DateTime ToUtc, int OffsetMinutes)
{
    public int Days => ToDate.DayNumber - FromDate.DayNumber + 1;
}

/// <summary>A period the person asked for that cannot be answered; the message is for them.</summary>
public sealed class PeriodException(string message) : Exception(message);

/// <summary>
/// Turns "yesterday" or two dates into the window the reports take. Days are
/// business days in the tenant's zone: a branch whose day starts at 17:00 is
/// still on yesterday's day at 02:00, and its day D runs from D 17:00 to D+1
/// 17:00. Pure, so the unit tests pin the arithmetic.
/// </summary>
public static class PeriodResolver
{
    public static readonly string[] Named =
    [
        "today", "yesterday", "this_week", "last_week", "this_month", "last_month",
        "last_7_days", "last_30_days", "this_year",
    ];

    /// <summary>More than a year in one answer is too much for one reply.</summary>
    public const int MaxDays = 366;

    /// <summary>The business day the clock is on right now, for a branch with this day start.</summary>
    public static DateOnly BusinessToday(TimeZoneInfo zone, TimeOnly dayStart, DateTimeOffset nowUtc)
    {
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone).DateTime;
        return DateOnly.FromDateTime(local - dayStart.ToTimeSpan());
    }

    public static Period Resolve(string? period, string? from, string? to, TimeZoneInfo zone, TimeOnly dayStart, DateTimeOffset nowUtc, DayOfWeek weekStart = DayOfWeek.Monday)
    {
        var today = BusinessToday(zone, dayStart, nowUtc);
        DateOnly f, t;

        if (!string.IsNullOrWhiteSpace(from) || !string.IsNullOrWhiteSpace(to))
        {
            if (string.IsNullOrWhiteSpace(from))
                throw new PeriodException("Give 'from' as yyyy-MM-dd when you give 'to'.");
            f = ParseDate(from, "from");
            t = string.IsNullOrWhiteSpace(to) ? f : ParseDate(to, "to");
        }
        else
        {
            var key = Normalize(period ?? "today");
            (f, t) = key switch
            {
                "today" => (today, today),
                "yesterday" => (today.AddDays(-1), today.AddDays(-1)),
                "this_week" => (StartOfWeek(today, weekStart), today),
                "last_week" => (StartOfWeek(today, weekStart).AddDays(-7), StartOfWeek(today, weekStart).AddDays(-1)),
                "this_month" => (FirstOfMonth(today), today),
                "last_month" => (FirstOfMonth(today).AddMonths(-1), FirstOfMonth(today).AddDays(-1)),
                "last_7_days" => (today.AddDays(-6), today),
                "last_30_days" => (today.AddDays(-29), today),
                "this_year" => (new DateOnly(today.Year, 1, 1), today),
                _ => throw new PeriodException($"Unknown period '{period}'. Use one of {string.Join(", ", Named)}, or from/to as yyyy-MM-dd."),
            };
        }

        if (t < f)
            throw new PeriodException("'to' is before 'from'.");
        if (t.DayNumber - f.DayNumber + 1 > MaxDays)
            throw new PeriodException("That is more than a year; ask for it month by month.");

        var fromLocal = f.ToDateTime(dayStart);
        var toLocal = t.AddDays(1).ToDateTime(dayStart);
        return new Period(
            $"{f:yyyy-MM-dd}..{t:yyyy-MM-dd}",
            f, t,
            ToUtc(fromLocal, zone), ToUtc(toLocal, zone),
            (int)zone.GetUtcOffset(fromLocal).TotalMinutes);
    }

    /// <summary>"this_month", "last_month" or "yyyy-MM" as the calendar month the profit report takes.</summary>
    public static (int Year, int Month) ResolveMonth(string? month, TimeZoneInfo zone, DateTimeOffset nowUtc)
    {
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone).DateTime;
        switch (Normalize(month ?? "this_month"))
        {
            case "this_month":
                return (local.Year, local.Month);
            case "last_month":
                var previous = local.AddMonths(-1);
                return (previous.Year, previous.Month);
        }
        if (DateTime.TryParseExact(month!.Trim(), ["yyyy-MM", "yyyy-M"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return (parsed.Year, parsed.Month);
        throw new PeriodException($"Unknown month '{month}'. Use this_month, last_month or yyyy-MM.");
    }

    /// <summary>IANA id first, then the Windows name, then UTC: the same chain as the services' TenantClock.</summary>
    public static TimeZoneInfo FindZone(string? ianaId)
    {
        if (string.IsNullOrWhiteSpace(ianaId))
            ianaId = TenantClockDefault;
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
        }
        catch (TimeZoneNotFoundException)
        {
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(ianaId, out var windowsId))
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(windowsId); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>Where the working week starts: Saturday in the Gulf and the Levant, Monday elsewhere.</summary>
    public static DayOfWeek WeekStart(string? country) => country?.ToUpperInvariant() switch
    {
        "EG" or "SA" or "AE" or "KW" or "QA" or "BH" or "OM" or "JO" or "IQ" or "LY" or "SD" or "YE" or "PS" => DayOfWeek.Saturday,
        _ => DayOfWeek.Monday,
    };

    private const string TenantClockDefault = "Africa/Cairo";

    private static string Normalize(string s) => s.Trim().ToLowerInvariant().Replace('-', '_').Replace(' ', '_');

    private static DateOnly ParseDate(string value, string name)
        => DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : throw new PeriodException($"'{name}' must be a date as yyyy-MM-dd, not '{value}'.");

    private static DateOnly FirstOfMonth(DateOnly d) => new(d.Year, d.Month, 1);

    private static DateOnly StartOfWeek(DateOnly d, DayOfWeek weekStart)
    {
        var back = ((int)d.DayOfWeek - (int)weekStart + 7) % 7;
        return d.AddDays(-back);
    }

    private static DateTime ToUtc(DateTime local, TimeZoneInfo zone)
    {
        var unspecified = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(unspecified))
            unspecified = unspecified.AddHours(1); // the spring-forward gap: the day starts an hour later
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, zone);
    }
}
