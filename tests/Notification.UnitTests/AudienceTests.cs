using Microsoft.Extensions.Configuration;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.UnitTests;

/// <summary>
/// A push reads in the words its reader expects: the back office gets one
/// Arabic whatever the café chose, a customer gets the Arabic their café
/// speaks. The two are told apart by type, so this pins that they stay so.
/// </summary>
[TestClass]
public sealed class AudienceTests
{
    private static TenantArabic Speaking(string? style, string country = "EG") =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Tenant:ArabicStyle"] = style,
                ["Tenant:Country"] = country,
            })
            .Build());

    // ---------------------------------------------------------------
    // Which Arabic a café speaks

    [TestMethod]
    public void A_cafe_that_says_nothing_follows_its_country()
    {
        Assert.IsFalse(Speaking(null, "EG").Standard, "Egypt speaks Egyptian unless told otherwise");
        Assert.IsTrue(Speaking(null, "SA").Standard, "everywhere else speaks Standard");
    }

    [TestMethod]
    public void A_cafe_that_says_so_is_taken_at_its_word()
    {
        Assert.IsFalse(Speaking("egyptian", "SA").Standard);
        Assert.IsTrue(Speaking("standard", "EG").Standard);
        Assert.IsFalse(Speaking("EGYPTIAN").Standard, "the style is read without regard to case");
    }

    // ---------------------------------------------------------------
    // The back office

    [TestMethod]
    public void A_staff_push_reads_the_same_whichever_arabic_the_cafe_chose()
    {
        // These are plain LocalizedText, so there is nothing to choose from
        var title = NotificationMessages.NewOrderTitle;
        var body = NotificationMessages.NewOrderBody(7, "Nadia");

        Assert.AreEqual("طلب جديد!", title.GetText("ar"));
        StringAssert.Contains(body.GetText("ar"), "طلب #7");
        Assert.AreEqual("New Order!", title.GetText("en"));
    }

    [TestMethod]
    public void No_staff_push_keeps_an_egyptian_word_the_back_office_dropped()
    {
        var egyptianisms = new[] { "أوردر", "عايز", "دلوقتي", "مستني", "اتأكد", "اتلغى", "كاش", "فيزا" };
        var staff = new[]
        {
            NotificationMessages.NewOrderTitle.GetText("ar"),
            NotificationMessages.NewReservationTitle.GetText("ar"),
            NotificationMessages.WaiterNeededTitle.GetText("ar"),
            NotificationMessages.BillRequestedTitle.GetText("ar"),
            NotificationMessages.ServiceRequestTitle.GetText("ar"),
            NotificationMessages.ReservationCancelledTitle.GetText("ar"),
            NotificationMessages.ShiftClosedTitle.GetText("ar"),
            NotificationMessages.OrderReminderTitle(1).GetText("ar"),
            NotificationMessages.OrderReminderTitle(4).GetText("ar"),
        };

        foreach (var line in staff)
        {
            foreach (var word in egyptianisms)
            {
                Assert.IsFalse(line.Contains(word), $"the back office still says \"{word}\" in: {line}");
            }
        }
    }

    // ---------------------------------------------------------------
    // The customer

    [TestMethod]
    public void A_customer_push_follows_the_cafes_own_arabic()
    {
        var title = NotificationMessages.OrderConfirmedTitle;

        Assert.AreEqual("الأوردر اتأكد", title.For(standardArabic: false).GetText("ar"));
        Assert.AreEqual("تم تأكيد الطلب", title.For(standardArabic: true).GetText("ar"));
    }

    [TestMethod]
    public void A_customer_push_in_english_is_the_same_either_way()
    {
        var body = NotificationMessages.OrderCancelledBody(42);

        Assert.AreEqual(body.For(standardArabic: true).GetText("en"), body.For(standardArabic: false).GetText("en"));
        StringAssert.Contains(body.For(standardArabic: false).GetText("en"), "#42");
    }

    [TestMethod]
    public void Every_customer_line_actually_differs_between_the_two()
    {
        var lines = new[]
        {
            NotificationMessages.RoomAvailableTitle,
            NotificationMessages.RoomAvailableBody(new LocalizedText("Room 3", "أوضة 3"), "ar"),
            NotificationMessages.OrderConfirmedTitle,
            NotificationMessages.OrderConfirmedBody(7),
            NotificationMessages.OrderCancelledTitle,
            NotificationMessages.OrderCancelledBody(7),
            NotificationMessages.YourReservationCancelledTitle,
            NotificationMessages.YourReservationCancelledBody(new LocalizedText("Room 3", "أوضة 3"), "ar"),
        };

        foreach (var line in lines)
        {
            Assert.AreNotEqual(line.Egyptian, line.Standard,
                $"a customer line that reads the same in both needs only one: {line.En}");
        }
    }

    // ---------------------------------------------------------------
    // The one push that goes to both

    [TestMethod]
    public void A_cancelled_reservation_tells_each_side_in_its_own_words()
    {
        var place = new LocalizedText("Room 3", "أوضة 3");
        var cafe = Speaking("egyptian");

        // The café's copy: the back office's Arabic
        var staff = NotificationMessages.ReservationCancelledBody("Nadia", place, "ar").GetText("ar");
        StringAssert.Contains(staff, "ألغى");

        // The customer's copy: their café speaks Egyptian, so they get Egyptian
        var customer = NotificationMessages.YourReservationCancelledBody(place, "ar")
            .For(cafe.Standard)
            .GetText("ar");
        StringAssert.Contains(customer, "اتلغى");
        Assert.AreNotEqual(staff, customer);
    }
}
