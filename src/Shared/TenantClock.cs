namespace Ninja;

/// <summary>
/// The café's wall clock. Offers are set in local time ("2 to 5 pm on
/// weekdays"), a shift that pays a wage at 02:00 is still yesterday's, and
/// the business day rolls over in the café's own zone, not UTC. The zone
/// is the tenant's (<c>Tenant:TimeZone</c>, an IANA id), set once at boot
/// by <see cref="Configure"/>; Cairo until someone says otherwise.
/// </summary>
public static class TenantClock
{
    public const string DefaultZone = "Africa/Cairo";

    public static TimeZoneInfo Zone { get; private set; } = Find(DefaultZone);

    /// <summary>Swapped by tests; production reads the real clock.</summary>
    public static Func<DateTime> UtcNow { get; set; } = () => DateTime.UtcNow;

    public static DateTime Now => ToLocal(UtcNow());

    public static DateTime ToLocal(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    public static void Configure(string? ianaId)
        => Zone = Find(string.IsNullOrWhiteSpace(ianaId) ? DefaultZone : ianaId.Trim());

    /// <summary>The zone by its IANA id, by its Windows name where only that is known, UTC when neither is.</summary>
    private static TimeZoneInfo Find(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId))
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(windowsId); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}
