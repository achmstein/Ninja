namespace Ninja.Ordering.UnitTests.Application;

using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// The back office's guest list is folded from guest orders: one guest per
/// phone, whatever device they ordered from, and only the orders that went
/// ahead count toward what they spent.
/// </summary>
[TestClass]
public class GuestDirectoryTest
{
    private static readonly DateTime Monday = new(2026, 9, 21, 10, 0, 0, DateTimeKind.Utc);

    private static int _nextId;

    private static GuestOrderRow Row(
        string guestId,
        string? phone,
        string? name = "Guest",
        int daysLater = 0,
        double total = 50,
        bool cancelled = false)
        => new(Interlocked.Increment(ref _nextId), guestId, name, phone, Monday.AddDays(daysLater), cancelled, total);

    [TestMethod]
    public void One_phone_is_one_guest_across_devices()
    {
        var guests = GuestDirectory.Aggregate(
        [
            Row("phone-a", "01012345678", "Mona", daysLater: 0),
            Row("laptop-b", "010 1234 5678", "Mona S.", daysLater: 2),
            Row("phone-c", "01198765432", "Ali", daysLater: 1),
        ]);

        Assert.HasCount(2, guests);

        var mona = guests.Single(g => g.Key == "01012345678");
        Assert.AreEqual(2, mona.OrderCount);
        Assert.AreEqual(100, mona.TotalSpent);
        // The latest order says who they are now
        Assert.AreEqual("Mona S.", mona.Name);
        Assert.AreEqual("010 1234 5678", mona.Phone);
        Assert.AreEqual(Monday, mona.FirstOrderAt);
        Assert.AreEqual(Monday.AddDays(2), mona.LastOrderAt);
    }

    [TestMethod]
    public void Most_recent_guest_comes_first()
    {
        var guests = GuestDirectory.Aggregate(
        [
            Row("a", "01000000001", daysLater: 1),
            Row("b", "01000000002", daysLater: 3),
            Row("c", "01000000003", daysLater: 2),
        ]);

        CollectionAssert.AreEqual(
            new[] { "01000000002", "01000000003", "01000000001" },
            guests.Select(g => g.Key).ToArray());
    }

    [TestMethod]
    public void A_cancelled_order_is_not_spent_but_the_guest_is_still_listed()
    {
        var guests = GuestDirectory.Aggregate(
        [
            Row("a", "01012345678", total: 80),
            Row("a", "01012345678", total: 200, cancelled: true, daysLater: 1),
            Row("b", "01199999999", total: 40, cancelled: true),
        ]);

        var kept = guests.Single(g => g.Key == "01012345678");
        Assert.AreEqual(1, kept.OrderCount);
        Assert.AreEqual(80, kept.TotalSpent);
        // Their last visit is still when they last ordered
        Assert.AreEqual(Monday.AddDays(1), kept.LastOrderAt);

        // Turned away at the table: nothing spent, but staff can still find them
        var turnedAway = guests.Single(g => g.Key == "01199999999");
        Assert.AreEqual(0, turnedAway.OrderCount);
        Assert.AreEqual(0, turnedAway.TotalSpent);
    }

    [TestMethod]
    public void An_order_without_a_phone_is_its_device_and_never_shows_the_guest_id()
    {
        var guests = GuestDirectory.Aggregate(
        [
            Row("secret-device-id", null),
            Row("secret-device-id", "  "),
            Row("other-device", null),
        ]);

        Assert.HasCount(2, guests);
        Assert.IsTrue(guests.All(g => !g.Key.Contains("device")), "The guest id is the device's secret.");
        Assert.AreEqual(2, guests.Single(g => g.Key == GuestDirectory.KeyFor("secret-device-id", null)).OrderCount);
    }

    [TestMethod]
    public void Search_matches_any_name_they_ordered_under_or_the_phone()
    {
        var orders = new[]
        {
            Row("a", "01012345678", "Mona", daysLater: 0),
            Row("a", "01012345678", "M", daysLater: 1),
            Row("b", "01198765432", "Ali"),
        };

        Assert.AreEqual("01012345678", GuestDirectory.Aggregate(orders, "mona").Single().Key);
        Assert.AreEqual("01198765432", GuestDirectory.Aggregate(orders, "9876").Single().Key);
        // An Arabic keyboard types Arabic-Indic digits
        Assert.AreEqual("01198765432", GuestDirectory.Aggregate(orders, "٩٨٧٦").Single().Key);
        Assert.HasCount(0, GuestDirectory.Aggregate(orders, "nobody"));
    }

    [TestMethod]
    public void A_claimed_order_is_the_accounts_not_a_guests()
    {
        DomainOrder GuestOrder() => new(string.Empty, string.Empty, branchId: 1,
            guestId: "device", guestName: "Mona", guestPhone: "01012345678", placeId: 3);

        var unclaimed = GuestOrder();
        var claimed = GuestOrder();
        // Signing in assigns the order to the account's buyer
        claimed.SetBuyerId(7);
        var counterSale = new DomainOrder(string.Empty, string.Empty, branchId: 1, guestName: "Mona", source: OrderSource.Pos);

        var isGuests = GuestDirectory.IsUnclaimedGuestOrder.Compile();

        Assert.IsTrue(isGuests(unclaimed));
        Assert.IsFalse(isGuests(claimed));
        Assert.IsFalse(isGuests(counterSale));
    }
}
