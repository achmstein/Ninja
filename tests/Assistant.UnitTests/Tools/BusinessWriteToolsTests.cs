using System.Net;
using System.Text.Json;
using Ninja.Assistant.API.Tools;
using Ninja.Assistant.UnitTests.Support;
using static Ninja.Assistant.UnitTests.Tools.FinanceWriteToolsTests;

namespace Ninja.Assistant.UnitTests.Tools;

[TestClass]
public sealed class BusinessWriteToolsTests
{
    private static BusinessWriteTools Tools(Bench bench) => new(bench.Tenant, bench.Api, Flow(bench), bench.Clock);

    /// <summary>Maadi with everything its edit form saves, and Nasr City</summary>
    private static Bench Business()
    {
        var bench = new Bench();
        bench.Handler.OnJson("GET", "tenant-api/api/branches/all", _ => new object[]
        {
            new
            {
                id = 2, name = new { en = "Maadi", ar = "المعادي" }, address = new { en = "Road 9", ar = "شارع ٩" }, phone = "+20225550000", taxNumber = "123-456",
                receiptFooter = new { en = "Thank you", ar = "شكرا" }, isActive = true, displayOrder = 2, dayStartTime = "00:00", dayEndTime = "00:00",
                isOrderingEnabled = true, isReservationsEnabled = true, isDeliveryEnabled = false, deliveryRadiusKm = (decimal?)null, deliveryFee = 0, deliveryMinimumOrder = 0,
            },
            new
            {
                id = 1, name = new { en = "Nasr City", ar = "مدينة نصر" }, address = (object?)null, phone = (string?)null, taxNumber = (string?)null,
                receiptFooter = (object?)null, isActive = true, displayOrder = 1, dayStartTime = "17:00", dayEndTime = "17:00",
                isOrderingEnabled = true, isReservationsEnabled = true, isDeliveryEnabled = false, deliveryRadiusKm = (decimal?)null, deliveryFee = 0, deliveryMinimumOrder = 0,
            },
        });
        bench.Handler.OnJson("GET", "tenant-api/api/tenant", _ => new { name = new { en = "Chillax" }, locale = new { country = "EG", currency = "EGP", timeZone = "Africa/Cairo", language = "ar" } });
        bench.Handler.OnJson("GET", "sales-api/api/tickets/pricing/2", _ => new { branchId = 2, vatRate = 0.14m, pricesIncludeVat = true, serviceChargeRate = 0m, maxCashierDiscountRate = 0.10m });
        return bench;
    }

    [TestMethod]
    public async Task A_branch_edit_previews_the_change_and_puts_the_whole_branch_back()
    {
        var bench = Business();
        bench.Handler.OnJson("PUT", "tenant-api/api/branches/2", _ => new { id = 2, name = new { en = "Maadi", ar = "المعادي" }, isActive = true });
        var tools = Tools(bench);

        var preview = await tools.UpdateBranch("Maadi", phone: "0225551234", dayStartTime: "4:00", deliveryRadiusKm: 5, deliveryFee: 20, reservations: false, requestId: "r1");
        Assert.AreNotEqual(true, preview.IsError, Bench.TextOf(preview));
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "phone +20225550000 → 0225551234");
        StringAssert.Contains(text, "business day starts 00:00 → 04:00");
        StringAssert.Contains(text, "delivery radius none → 5 km");
        StringAssert.Contains(text, "delivery fee EGP 0 → EGP 20");
        StringAssert.Contains(text, "reservations on → off");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.UpdateBranch("Maadi", phone: "0225551234", dayStartTime: "4:00", deliveryRadiusKm: 5, deliveryFee: 20, reservations: false, requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        var put = Writes(bench).Single();
        Assert.AreEqual(HttpMethod.Put, put.Method);
        Assert.AreEqual("2", put.Branch);
        Assert.IsFalse(put.Url.Query.Contains("api-version"), "Tenant.API is not versioned");
        using var body = JsonDocument.Parse(put.Body!);
        var b = body.RootElement;
        Assert.AreEqual("Maadi", b.GetProperty("name").GetProperty("en").GetString());
        Assert.AreEqual("شارع ٩", b.GetProperty("address").GetProperty("ar").GetString(), "the address stays");
        Assert.AreEqual("123-456", b.GetProperty("taxNumber").GetString(), "the tax number stays");
        Assert.AreEqual("Thank you", b.GetProperty("receiptFooter").GetProperty("en").GetString(), "the footer stays");
        Assert.AreEqual(2, b.GetProperty("displayOrder").GetInt32());
        Assert.AreEqual("0225551234", b.GetProperty("phone").GetString());
        Assert.AreEqual("04:00", b.GetProperty("dayStartTime").GetString());
        Assert.AreEqual(5m, b.GetProperty("deliveryRadiusKm").GetDecimal());
        Assert.IsFalse(b.GetProperty("isReservationsEnabled").GetBoolean());
        Assert.AreEqual(JsonValueKind.Null, b.GetProperty("isOrderingEnabled").ValueKind, "a switch not named is left as it is");
        Assert.AreEqual(JsonValueKind.Null, b.GetProperty("location").ValueKind, "the map point is left where it is");
    }

    [TestMethod]
    public async Task An_arabic_address_replaces_the_arabic_side_only()
    {
        var bench = Business();
        bench.Handler.OnJson("PUT", "tenant-api/api/branches/2", _ => new { id = 2, isActive = true });
        await Tools(bench).UpdateBranch("2", address: "شارع ٢٠", requestId: "r1", confirm: true);
        using var body = JsonDocument.Parse(Writes(bench).Single().Body!);
        Assert.AreEqual("Road 9", body.RootElement.GetProperty("address").GetProperty("en").GetString());
        Assert.AreEqual("شارع ٢٠", body.RootElement.GetProperty("address").GetProperty("ar").GetString());
    }

    [TestMethod]
    public async Task Pricing_speaks_percents_and_sends_fractions_keeping_the_rest()
    {
        var bench = Business();
        bench.Handler.On("PUT", "sales-api/api/tickets/pricing/2", _ => new HttpResponseMessage(HttpStatusCode.OK));
        var tools = Tools(bench);

        var preview = await tools.SetPricingRules("Maadi", serviceChargePercent: 12, requestId: "r1");
        StringAssert.Contains(Bench.JsonOf(preview).GetProperty("preview").GetString(), "service charge 0% → 12%");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.SetPricingRules("Maadi", serviceChargePercent: 12, requestId: "r1", confirm: true);
        Assert.AreNotEqual(true, done.IsError, Bench.TextOf(done));
        var put = Writes(bench).Single();
        Assert.AreEqual("2", put.Branch);
        using var body = JsonDocument.Parse(put.Body!);
        Assert.AreEqual(0.12m, body.RootElement.GetProperty("serviceChargeRate").GetDecimal());
        Assert.AreEqual(0.14m, body.RootElement.GetProperty("vatRate").GetDecimal(), "VAT stays");
        Assert.IsTrue(body.RootElement.GetProperty("pricesIncludeVat").GetBoolean());
        Assert.AreEqual(0.10m, body.RootElement.GetProperty("maxCashierDiscountRate").GetDecimal());
    }

    [TestMethod]
    public async Task A_percent_over_100_is_refused()
    {
        var result = await Tools(Business()).SetPricingRules("Maadi", vatPercent: 140);
        Assert.IsTrue(result.IsError);
    }

    [TestMethod]
    public async Task An_announcement_previews_its_words_then_is_sent_once()
    {
        var bench = Business();
        var sent = new List<object>();
        bench.Handler.OnJson("GET", "notification-api/api/notifications/announcements", _ => sent);
        bench.Handler.OnJson("POST", "notification-api/api/notifications/announcements", _ =>
        {
            var a = new { id = 4, title = "Friday", body = "We open at 2 pm", sentBy = "Owner One", sentAt = bench.Clock.GetUtcNow().UtcDateTime, recipientCount = 120 };
            sent.Add(a);
            return a;
        });
        var tools = Tools(bench);

        var preview = await tools.SendAnnouncement(" Friday ", "We open at 2 pm", "r1");
        var text = Bench.JsonOf(preview).GetProperty("preview").GetString()!;
        StringAssert.Contains(text, "Friday\nWe open at 2 pm");
        StringAssert.Contains(text, "cannot be taken back");
        Assert.IsFalse(Writes(bench).Any());

        var done = await tools.SendAnnouncement("Friday", "We open at 2 pm", "r1", confirm: true);
        Assert.AreEqual(120, Bench.JsonOf(done).GetProperty("recipients").GetInt32());
        var post = Writes(bench).Single();
        Assert.IsFalse(post.Url.Query.Contains("api-version"), "Notification.API is not versioned");
        using var body = JsonDocument.Parse(post.Body!);
        Assert.AreEqual("Friday", body.RootElement.GetProperty("title").GetString());

        bench.Clock.Advance(TimeSpan.FromMinutes(2));
        var retried = await tools.SendAnnouncement("Friday", "We open at 2 pm", "r1", confirm: true);
        StringAssert.Contains(Bench.JsonOf(retried).GetProperty("note").GetString(), "not sent twice");
        Assert.AreEqual(1, Writes(bench).Count(), "a customer's phone rings once");
    }
}
