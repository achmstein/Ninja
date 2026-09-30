namespace Ninja.Ordering.UnitTests.Application;

using System.Text.Json;
using Ninja.Ordering.API.Talabat;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

[TestClass]
public class TalabatOrderTest
{
    // Delivery Hero's own example, with our remote codes and its habit of writing numbers as strings
    private const string Dispatch = """
    {
      "token": "5f373562-591a-4db9-8609-7eec7880f28d",
      "code": "n0s1-w0k1",
      "shortCode": "42",
      "comments": { "customerComment": "Please hurry" },
      "customer": { "firstName": "Mona", "lastName": "Adel", "mobilePhone": "+201001234567" },
      "delivery": {
        "address": { "street": "Tahrir St", "number": "12", "city": "Cairo" },
        "expectedDeliveryTime": "2026-09-29T17:50:00.000Z",
        "riderPickupTime": "2026-09-29T17:35:00.000Z"
      },
      "expeditionType": "delivery",
      "payment": { "status": "paid", "type": "paid" },
      "price": { "grandTotal": "25.50", "collectFromCustomer": "0" },
      "products": [
        {
          "name": "Latte", "paidPrice": "95.00", "quantity": "2", "remoteCode": "item-12", "unitPrice": "40.00",
          "comment": "Extra hot",
          "selectedToppings": [
            { "name": "Oat milk", "price": "7.50", "quantity": 1, "remoteCode": "option-7", "children": [] }
          ]
        },
        { "name": "Croissant", "paidPrice": 30, "quantity": 1, "remoteCode": "item-3" }
      ],
      "callbackUrls": {
        "orderAcceptedUrl": "https://mw.example/v2/order/status/5f37",
        "orderRejectedUrl": "https://mw.example/v2/order/status/5f37",
        "orderPreparedUrl": "https://mw.example/v2/orders/5f37/preparation-completed"
      },
      "somethingAddedLater": { "ignored": true }
    }
    """;

    private static TalabatReadResult Read(string json) => TalabatOrder.Read(JsonDocument.Parse(json).RootElement);

    [TestMethod]
    public void Lines_map_to_menu_items_and_options_by_remote_code_at_what_the_customer_paid()
    {
        var order = Read(Dispatch).Order!;

        Assert.AreEqual(2, order.Items.Count);
        var latte = order.Items[0];
        Assert.AreEqual(12, latte.ProductId);
        Assert.AreEqual(2, latte.Quantity);
        Assert.AreEqual(47.50m, latte.UnitPrice, "the line's paid price split over its units");
        Assert.AreEqual(47.50m, latte.TotalPrice, "an option adds nothing: its price is in the line's already");
        Assert.AreEqual(7, latte.SelectedCustomizations.Single().OptionId);
        Assert.AreEqual("Extra hot", latte.SpecialInstructions);
        Assert.AreEqual(3, order.Items[1].ProductId);
        Assert.AreEqual(30m, order.Items[1].UnitPrice);
    }

    [TestMethod]
    public void A_delivery_with_a_rider_pickup_time_is_the_platforms_rider_and_carries_no_address()
    {
        var order = Read(Dispatch).Order!;

        Assert.AreEqual(PlatformExpedition.PlatformDelivery, order.Expedition);
        Assert.AreEqual(new DateTime(2026, 9, 29, 17, 35, 0, DateTimeKind.Utc), order.RiderPickupAt);
        Assert.IsNull(order.DeliveryAddress);
        Assert.IsTrue(order.PaidOnline);
        Assert.AreEqual("Mona Adel", order.CustomerName);
        Assert.AreEqual("n0s1-w0k1", order.Code);
        Assert.AreEqual("42", order.ShortCode);
        Assert.AreEqual("Please hurry", order.CustomerComment);
        Assert.IsNull(order.Callbacks.PickedUp, "a change with no address is not reported");
    }

    [TestMethod]
    public void A_delivery_without_a_rider_is_the_business_own_and_keeps_the_address()
    {
        var json = Dispatch.Replace("\"riderPickupTime\": \"2026-09-29T17:35:00.000Z\"", "\"riderPickupTime\": null");

        var order = Read(json).Order!;

        Assert.AreEqual(PlatformExpedition.VendorDelivery, order.Expedition);
        Assert.AreEqual("Tahrir St, 12, Cairo", order.DeliveryAddress);
    }

    [TestMethod]
    public void Pickup_is_pickup()
    {
        var json = Dispatch.Replace("\"expeditionType\": \"delivery\"", "\"expeditionType\": \"pickup\"");

        Assert.AreEqual(PlatformExpedition.Pickup, Read(json).Order!.Expedition);
    }

    [TestMethod]
    public void A_remote_code_Ninja_never_sent_turns_the_order_down_for_the_menu()
    {
        var result = Read(Dispatch.Replace("item-3", "BURGER_01"));

        Assert.IsNull(result.Order);
        Assert.AreEqual(PlatformRejectReasons.MenuAccountSettings, result.Reason);
        StringAssert.Contains(result.Message, "Croissant");
    }

    [TestMethod]
    public void An_option_code_Ninja_never_sent_turns_it_down_too()
    {
        var result = Read(Dispatch.Replace("option-7", "item-7"));

        Assert.AreEqual(PlatformRejectReasons.MenuAccountSettings, result.Reason);
    }

    [TestMethod]
    public void An_order_without_a_token_is_refused()
    {
        Assert.AreEqual(PlatformRejectReasons.TechnicalProblem, Read("""{ "code": "x", "products": [] }""").Reason);
    }

    [TestMethod]
    public void It_becomes_a_platform_order_with_the_addresses_to_report_to()
    {
        var platform = Read(Dispatch).Order!.ToPlatformOrder();

        Assert.AreEqual("Talabat", platform.Name);
        Assert.AreEqual("5f373562-591a-4db9-8609-7eec7880f28d", platform.Token);
        Assert.AreEqual("https://mw.example/v2/order/status/5f37", platform.AcceptedUrl);
        Assert.AreEqual("https://mw.example/v2/orders/5f37/preparation-completed", platform.PreparedUrl);
    }

    [TestMethod]
    public void The_acceptance_time_is_the_riders_pickup_but_never_within_three_minutes()
    {
        var now = new DateTime(2026, 9, 29, 17, 0, 0, DateTimeKind.Utc);
        var platform = Read(Dispatch).Order!.ToPlatformOrder();

        Assert.AreEqual(new DateTime(2026, 9, 29, 17, 35, 0, DateTimeKind.Utc), PlatformUpdateHandlers.AcceptanceTime(platform, now));
        Assert.AreEqual(now.AddMinutes(40).AddMinutes(3), PlatformUpdateHandlers.AcceptanceTime(platform, now.AddMinutes(40)));
    }
}
