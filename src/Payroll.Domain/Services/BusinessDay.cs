#nullable enable
namespace Ninja.Payroll.Domain.Services;

/// <summary>
/// The café's day, as attendance and wages count it: a shift that opens in
/// the evening and pays a wage at 02:00 is still yesterday's. The branch's
/// own day window lives in Branch.API; until it travels on an event this
/// uses the tenant's local time (<see cref="TenantClock"/>) with an
/// early-morning cutoff, which matches how the café runs.
/// </summary>
public static class BusinessDay
{
    /// <summary>Anything before this hour belongs to the previous day.</summary>
    public const int CutoffHour = 6;

    public static DateOnly Of(DateTime utc)
    {
        var local = TenantClock.ToLocal(utc);
        var day = DateOnly.FromDateTime(local);
        return local.Hour < CutoffHour ? day.AddDays(-1) : day;
    }
}
