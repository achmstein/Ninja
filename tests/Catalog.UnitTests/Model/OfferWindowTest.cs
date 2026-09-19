using Ninja;
using Ninja.Catalog.API.Model;

namespace Catalog.UnitTests.Model;

[TestClass]
public class OfferWindowTest
{
    // Monday 2026-09-14
    private static readonly DateTime Monday = new(2026, 9, 14, 0, 0, 0);
    private const int Weekdays = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5); // Mon..Fri

    private static TimeOnly At(int h, int m = 0) => new(h, m);

    [TestMethod]
    public void No_window_is_always_on()
    {
        Assert.IsTrue(OfferWindow.Covers(null, null, null, Monday.AddHours(3)));
        Assert.IsTrue(OfferWindow.Covers(0, null, null, Monday.AddHours(23)));
    }

    [TestMethod]
    public void Weekdays_alone_gate_the_day()
    {
        Assert.IsTrue(OfferWindow.Covers(Weekdays, null, null, Monday.AddHours(12)));
        Assert.IsFalse(OfferWindow.Covers(Weekdays, null, null, Monday.AddDays(5).AddHours(12))); // Saturday
    }

    [TestMethod]
    public void Hours_alone_gate_the_time_start_inclusive_end_exclusive()
    {
        Assert.IsFalse(OfferWindow.Covers(null, At(14), At(17), Monday.AddHours(13).AddMinutes(59)));
        Assert.IsTrue(OfferWindow.Covers(null, At(14), At(17), Monday.AddHours(14)));
        Assert.IsTrue(OfferWindow.Covers(null, At(14), At(17), Monday.AddHours(16).AddMinutes(59)));
        Assert.IsFalse(OfferWindow.Covers(null, At(14), At(17), Monday.AddHours(17)));
    }

    [TestMethod]
    public void A_window_past_midnight_belongs_to_the_day_it_started()
    {
        // Friday 22:00 to 03:00, weekdays only: Saturday 01:00 is still Friday's offer
        var friday = Monday.AddDays(4);
        Assert.IsTrue(OfferWindow.Covers(Weekdays, At(22), At(3), friday.AddHours(23)));
        Assert.IsTrue(OfferWindow.Covers(Weekdays, At(22), At(3), friday.AddDays(1).AddHours(1)));
        Assert.IsFalse(OfferWindow.Covers(Weekdays, At(22), At(3), friday.AddDays(1).AddHours(4)));
        // Sunday 23:00 is Sunday's, which is off
        Assert.IsFalse(OfferWindow.Covers(Weekdays, At(22), At(3), friday.AddDays(2).AddHours(23)));
    }

    [TestMethod]
    public void The_item_prices_by_its_window()
    {
        var item = new CatalogItem(new LocalizedText("Latte"))
        {
            Price = 100,
            IsOnOffer = true,
            OfferPrice = 80,
            OfferFrom = At(14),
            OfferTo = At(17),
        };

        // Monday 15:00 Cairo is 12:00 UTC in September (UTC+3, summer time)
        TenantClock.UtcNow = () => new DateTime(2026, 9, 14, 12, 0, 0, DateTimeKind.Utc);
        Assert.IsTrue(item.IsOfferActive);
        Assert.AreEqual(80m, item.EffectivePrice);

        TenantClock.UtcNow = () => new DateTime(2026, 9, 14, 16, 0, 0, DateTimeKind.Utc); // 19:00 Cairo
        Assert.IsFalse(item.IsOfferActive);
        Assert.AreEqual(100m, item.EffectivePrice);

        TenantClock.UtcNow = () => DateTime.UtcNow;
    }
}
