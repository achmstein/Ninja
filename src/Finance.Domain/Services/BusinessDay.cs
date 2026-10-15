#nullable enable
namespace Ninja.Finance.Domain.Services;

/// <summary>
/// The business's day, as attendance and wages count it: a shift that opens in
/// the evening and pays a wage at 02:00 is still yesterday's. A branch's day
/// starts at its own time (Tenant.API's DayStartTime, which Finance keeps from
/// the branch settings event) in the tenant's local time (<see cref="TenantClock"/>);
/// a branch Finance has not heard of yet turns over at <see cref="CutoffHour"/>,
/// which matches how the business runs.
/// </summary>
public static class BusinessDay
{
    /// <summary>Anything before this hour belongs to the previous day, where the branch's own start is not known.</summary>
    public const int CutoffHour = 6;

    public static readonly TimeOnly DefaultStart = new(CutoffHour, 0);

    public static DateOnly Of(DateTime utc) => Of(utc, DefaultStart);

    /// <summary>The day a moment belongs to at a branch whose day starts at <paramref name="dayStart"/>.</summary>
    public static DateOnly Of(DateTime utc, TimeOnly dayStart)
    {
        var local = TenantClock.ToLocal(utc);
        var day = DateOnly.FromDateTime(local);
        return TimeOnly.FromDateTime(local) < dayStart ? day.AddDays(-1) : day;
    }
}
