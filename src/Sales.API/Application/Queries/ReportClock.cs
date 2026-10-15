#nullable enable
namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// The wall clock a report's hours and days are read in. Sales keeps every
/// moment in UTC; the business reads its day in its own zone, whose offset
/// moves with daylight saving, so each moment is converted at its own offset
/// rather than one offset for the whole window.
/// </summary>
public static class ReportClock
{
    public static DateTime ToLocal(DateTime utc, TimeZoneInfo zone)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);

    /// <summary>A zone by its IANA id, or by its Windows name where only that is known; null when neither is.</summary>
    public static TimeZoneInfo? FindZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return null;

        try { return TimeZoneInfo.FindSystemTimeZoneById(id.Trim()); }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id.Trim(), out var windowsId))
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(windowsId); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return null;
    }
}
