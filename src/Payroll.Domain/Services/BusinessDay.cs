#nullable enable
namespace Chillax.Payroll.Domain.Services;

/// <summary>
/// The café's day, as attendance and wages count it: a shift that opens in
/// the evening and pays a wage at 02:00 is still yesterday's. The branch's
/// own day window lives in Branch.API; until it travels on an event this
/// uses local time with an early-morning cutoff, which matches how the
/// café runs.
/// </summary>
public static class BusinessDay
{
    private static readonly TimeZoneInfo Cairo = FindCairo();

    /// <summary>Anything before this hour belongs to the previous day.</summary>
    public const int CutoffHour = 6;

    public static DateOnly Of(DateTime utc)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Cairo);
        var day = DateOnly.FromDateTime(local);
        return local.Hour < CutoffHour ? day.AddDays(-1) : day;
    }

    private static TimeZoneInfo FindCairo()
    {
        foreach (var id in new[] { "Africa/Cairo", "Egypt Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}
