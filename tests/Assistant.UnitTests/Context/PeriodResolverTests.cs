using Ninja.Assistant.API.Context;

namespace Ninja.Assistant.UnitTests.Context;

[TestClass]
public sealed class PeriodResolverTests
{
    private static readonly TimeZoneInfo Cairo = PeriodResolver.FindZone("Africa/Cairo");
    private static readonly TimeOnly FivePm = new(17, 0);
    private static readonly TimeOnly Midnight = TimeOnly.MinValue;

    [TestMethod]
    public void Cairo_is_found_by_its_iana_id()
    {
        Assert.AreNotEqual(TimeZoneInfo.Utc, Cairo);
        Assert.AreEqual(TimeSpan.FromHours(2), Cairo.BaseUtcOffset);
    }

    [TestMethod]
    public void An_unknown_zone_falls_back_to_utc()
    {
        Assert.AreEqual(TimeZoneInfo.Utc, PeriodResolver.FindZone("Mars/Olympus"));
    }

    [TestMethod]
    public void At_two_in_the_morning_a_five_pm_day_start_is_still_yesterday()
    {
        // 2026-09-23 02:00 Cairo (EEST, UTC+3) = 2026-09-22 23:00Z
        var now = new DateTimeOffset(2026, 9, 22, 23, 0, 0, TimeSpan.Zero);
        Assert.AreEqual(new DateOnly(2026, 9, 22), PeriodResolver.BusinessToday(Cairo, FivePm, now));
        Assert.AreEqual(new DateOnly(2026, 9, 23), PeriodResolver.BusinessToday(Cairo, Midnight, now));
    }

    [TestMethod]
    public void Today_runs_from_day_start_to_the_next_day_start_in_utc()
    {
        var now = new DateTimeOffset(2026, 9, 22, 23, 0, 0, TimeSpan.Zero);
        var p = PeriodResolver.Resolve("today", null, null, Cairo, FivePm, now);
        Assert.AreEqual("2026-09-22..2026-09-22", p.Label);
        Assert.AreEqual(new DateTime(2026, 9, 22, 14, 0, 0, DateTimeKind.Utc), p.FromUtc);   // 17:00 EEST
        Assert.AreEqual(new DateTime(2026, 9, 23, 14, 0, 0, DateTimeKind.Utc), p.ToUtc);
        Assert.AreEqual(180, p.OffsetMinutes);
        Assert.AreEqual(1, p.Days);
    }

    [TestMethod]
    public void Yesterday_ends_where_today_starts()
    {
        var now = new DateTimeOffset(2026, 9, 22, 23, 0, 0, TimeSpan.Zero);
        var today = PeriodResolver.Resolve("today", null, null, Cairo, FivePm, now);
        var yesterday = PeriodResolver.Resolve("yesterday", null, null, Cairo, FivePm, now);
        Assert.AreEqual(today.FromUtc, yesterday.ToUtc);
        Assert.AreEqual(new DateOnly(2026, 9, 21), yesterday.FromDate);
    }

    [TestMethod]
    public void Last_month_is_the_whole_calendar_month_before()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        var p = PeriodResolver.Resolve("last_month", null, null, Cairo, Midnight, now);
        Assert.AreEqual(new DateOnly(2026, 8, 1), p.FromDate);
        Assert.AreEqual(new DateOnly(2026, 8, 31), p.ToDate);
        Assert.AreEqual(31, p.Days);
    }

    [TestMethod]
    public void This_week_starts_on_saturday_in_egypt_and_monday_elsewhere()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero); // a Tuesday
        var egypt = PeriodResolver.Resolve("this_week", null, null, Cairo, Midnight, now, PeriodResolver.WeekStart("EG"));
        var europe = PeriodResolver.Resolve("this_week", null, null, Cairo, Midnight, now, PeriodResolver.WeekStart("DE"));
        Assert.AreEqual(new DateOnly(2026, 9, 19), egypt.FromDate);   // Saturday
        Assert.AreEqual(new DateOnly(2026, 9, 21), europe.FromDate);  // Monday
        Assert.AreEqual(new DateOnly(2026, 9, 22), egypt.ToDate);
    }

    [TestMethod]
    public void Explicit_dates_are_inclusive_business_days_and_named_periods_are_ignored()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        var p = PeriodResolver.Resolve("last_month", "2026-09-01", "2026-09-07", Cairo, FivePm, now);
        Assert.AreEqual(7, p.Days);
        Assert.AreEqual(new DateTime(2026, 9, 1, 14, 0, 0, DateTimeKind.Utc), p.FromUtc);
        Assert.AreEqual(new DateTime(2026, 9, 8, 14, 0, 0, DateTimeKind.Utc), p.ToUtc);
    }

    [TestMethod]
    public void A_from_without_to_is_that_one_day()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        var p = PeriodResolver.Resolve(null, "2026-09-05", null, Cairo, Midnight, now);
        Assert.AreEqual(new DateOnly(2026, 9, 5), p.FromDate);
        Assert.AreEqual(new DateOnly(2026, 9, 5), p.ToDate);
    }

    [TestMethod]
    public void Named_periods_accept_dashes_spaces_and_capitals()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        Assert.AreEqual(7, PeriodResolver.Resolve("Last 7 Days", null, null, Cairo, Midnight, now).Days);
        Assert.AreEqual(30, PeriodResolver.Resolve("last-30-days", null, null, Cairo, Midnight, now).Days);
    }

    [TestMethod]
    public void An_unknown_period_names_the_valid_ones()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        var ex = Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.Resolve("fortnight", null, null, Cairo, Midnight, now));
        StringAssert.Contains(ex.Message, "last_30_days");
        StringAssert.Contains(ex.Message, "yyyy-MM-dd");
    }

    [TestMethod]
    public void A_bad_date_and_a_reversed_range_are_refused()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.Resolve(null, "22/09/2026", null, Cairo, Midnight, now));
        Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.Resolve(null, "2026-09-10", "2026-09-01", Cairo, Midnight, now));
        Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.Resolve(null, null, "2026-09-01", Cairo, Midnight, now));
    }

    [TestMethod]
    public void More_than_a_year_is_refused()
    {
        var now = new DateTimeOffset(2026, 9, 22, 12, 0, 0, TimeSpan.Zero);
        Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.Resolve(null, "2025-01-01", "2026-06-01", Cairo, Midnight, now));
    }

    [TestMethod]
    public void A_day_start_inside_the_spring_forward_gap_moves_an_hour_later()
    {
        // Egypt springs forward on the last Friday of April at 00:00 -> 01:00 (2026-04-24)
        var now = new DateTimeOffset(2026, 4, 25, 12, 0, 0, TimeSpan.Zero);
        var p = PeriodResolver.Resolve(null, "2026-04-24", null, Cairo, new TimeOnly(0, 30), now);
        Assert.AreEqual(DateTimeKind.Utc, p.FromUtc.Kind);
        Assert.IsTrue(p.ToUtc > p.FromUtc);
    }

    [TestMethod]
    public void Months_resolve_to_this_last_or_a_named_one()
    {
        var now = new DateTimeOffset(2026, 1, 15, 12, 0, 0, TimeSpan.Zero);
        Assert.AreEqual((2026, 1), PeriodResolver.ResolveMonth("this_month", Cairo, now));
        Assert.AreEqual((2025, 12), PeriodResolver.ResolveMonth("last_month", Cairo, now));
        Assert.AreEqual((2025, 8), PeriodResolver.ResolveMonth("2025-08", Cairo, now));
        Assert.ThrowsExactly<PeriodException>(() => PeriodResolver.ResolveMonth("August", Cairo, now));
    }
}
