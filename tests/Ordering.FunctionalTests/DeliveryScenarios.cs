using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

public record DeliveryQuoteView(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm);
public record AddressView(int Id, string? Label, double Latitude, double Longitude, string Address, string? Building, string? Phone);

/// <summary>
/// The branch's own delivery at the door of the API: what a branch answers
/// for an address, the orders it refuses, the addresses a customer keeps, and
/// who may move a delivery along.
/// </summary>
[TestClass]
public sealed class DeliveryScenarios
{
    private const string Orders = "/api/orders";
    private const string Version = "api-version=1.0";

    /// <summary>A branch of its own, so turning delivery on here touches no other scenario</summary>
    private const int Delivering = 7;
    private const int NotDelivering = 8;

    // Tahrir Square, and points about 2 km and 20 km from it
    private const double Lat = 30.0444, Lng = 31.2357;
    private const double NearLat = 30.0600, NearLng = 31.2450;
    private const double FarLat = 29.8700, FarLng = 31.2357;

    private static Caller Customer(string userId, int branch = Delivering) => Suite.Ordering.As(Persona.Customer(userId), branch);

    private static async Task DeliverFromTahrirAsync()
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<BranchSettingsChangedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new BranchSettingsChangedIntegrationEvent(
            Delivering, IsOrderingEnabled: true, IsReservationsEnabled: true, RequireSignInForTableOrders: false,
            IsDeliveryEnabled: true, Latitude: Lat, Longitude: Lng, DeliveryRadiusKm: 5, DeliveryFee: 20, DeliveryMinimumOrder: 100));
    }

    private static object Order(double lat, double lng, decimal price) => new
    {
        userId = "",
        userName = "Mona",
        customerNote = (string?)null,
        pointsToRedeem = 0,
        loyaltyDiscount = 0,
        items = new[]
        {
            new { id = "1", productId = 1, productName = new { en = "Family meal", ar = "وجبة عائلية" }, unitPrice = price, oldUnitPrice = price, quantity = 1, pictureUrl = (string?)null },
        },
        delivery = new { latitude = lat, longitude = lng, address = "Qasr El Nil St", building = "12", phone = "01001234567" },
    };

    private static async Task<(HttpStatusCode Status, string Body)> PlaceAsync(Caller caller, object order)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{Orders}?{Version}")
        {
            Content = System.Net.Http.Json.JsonContent.Create(order, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", Guid.NewGuid().ToString());
        using var response = await caller.Http.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    [TestMethod]
    public async Task A_branch_that_does_not_deliver_says_so_and_refuses_a_delivery()
    {
        var customer = Customer($"customer-{Guid.NewGuid():N}", NotDelivering);

        var quote = await customer.GetAsync<DeliveryQuoteView>($"{Orders}/delivery/quote?latitude={NearLat}&longitude={NearLng}&{Version}");
        Assert.IsFalse(quote.Delivers);

        var (status, body) = await PlaceAsync(customer, Order(NearLat, NearLng, 150));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("isn't delivering", body);
    }

    [TestMethod]
    public async Task A_branch_answers_for_an_address_with_its_fee_minimum_and_reach()
    {
        await DeliverFromTahrirAsync();
        var customer = Customer($"customer-{Guid.NewGuid():N}");

        var near = await customer.GetAsync<DeliveryQuoteView>($"{Orders}/delivery/quote?latitude={NearLat}&longitude={NearLng}&{Version}");
        Assert.IsTrue(near.Delivers);
        Assert.IsTrue(near.InRange);
        Assert.AreEqual(20m, near.Fee);
        Assert.AreEqual(100m, near.MinimumOrder);
        Assert.IsTrue(near.DistanceMeters is > 1000 and < 3000, $"{near.DistanceMeters} m");

        var far = await customer.GetAsync<DeliveryQuoteView>($"{Orders}/delivery/quote?latitude={FarLat}&longitude={FarLng}&{Version}");
        Assert.IsFalse(far.InRange);
    }

    [TestMethod]
    public async Task A_delivery_too_far_or_too_small_is_refused_before_it_stands()
    {
        await DeliverFromTahrirAsync();
        var customer = Customer($"customer-{Guid.NewGuid():N}");

        var (tooFar, farBody) = await PlaceAsync(customer, Order(FarLat, FarLng, 150));
        Assert.AreEqual(HttpStatusCode.BadRequest, tooFar);
        Assert.Contains("outside", farBody);

        var (tooSmall, smallBody) = await PlaceAsync(customer, Order(NearLat, NearLng, 60));
        Assert.AreEqual(HttpStatusCode.BadRequest, tooSmall);
        Assert.Contains("at least 100", smallBody);

        var (ok, okBody) = await PlaceAsync(customer, Order(NearLat, NearLng, 150));
        Assert.AreEqual(HttpStatusCode.OK, ok, okBody);
    }

    [TestMethod]
    public async Task A_customer_keeps_their_own_addresses()
    {
        var userId = $"customer-{Guid.NewGuid():N}";
        var customer = Customer(userId);

        var saved = await customer.PostAsync<AddressView>($"{Orders}/addresses?{Version}", new
        {
            latitude = NearLat, longitude = NearLng, address = "Qasr El Nil St", building = "12", phone = "01001234567", label = "Home",
        });
        Assert.AreEqual("Home", saved.Label);

        var changed = await customer.PutAsync<AddressView>($"{Orders}/addresses/{saved.Id}?{Version}", new
        {
            latitude = NearLat, longitude = NearLng, address = "Qasr El Nil St", building = "14", phone = "01001234567", label = "Home",
        });
        Assert.AreEqual("14", changed.Building);

        var mine = await customer.GetAsync<List<AddressView>>($"{Orders}/addresses?{Version}");
        Assert.HasCount(1, mine);

        var someoneElse = await Customer($"customer-{Guid.NewGuid():N}").GetAsync<List<AddressView>>($"{Orders}/addresses?{Version}");
        Assert.IsEmpty(someoneElse, "nobody sees another customer's addresses");
        var (theirs, _) = await Customer($"customer-{Guid.NewGuid():N}").RefusedAsync(HttpMethod.Delete, $"{Orders}/addresses/{saved.Id}?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, theirs);

        using var removed = await customer.RawAsync(HttpMethod.Delete, $"{Orders}/addresses/{saved.Id}?{Version}");
        Assert.AreEqual(HttpStatusCode.NoContent, removed.StatusCode);
    }

    [TestMethod]
    public async Task An_address_needs_a_street_and_a_phone_that_can_be_called()
    {
        var customer = Customer($"customer-{Guid.NewGuid():N}");

        var (noStreet, _) = await customer.RefusedAsync(HttpMethod.Post, $"{Orders}/addresses?{Version}", new { latitude = NearLat, longitude = NearLng, address = " " });
        Assert.AreEqual(HttpStatusCode.BadRequest, noStreet);

        var (badPhone, _) = await customer.RefusedAsync(HttpMethod.Post, $"{Orders}/addresses?{Version}", new { latitude = NearLat, longitude = NearLng, address = "Qasr El Nil St", phone = "12" });
        Assert.AreEqual(HttpStatusCode.BadRequest, badPhone);
    }

    [TestMethod]
    public async Task A_rider_sees_their_own_deliveries_and_the_till_its_riders()
    {
        var rider = Suite.Ordering.As(Persona.Rider(Delivering, $"rider-{Guid.NewGuid():N}"), Delivering);

        var status = await rider.PutAsync<RiderStatusView>($"{Orders}/riders/me?{Version}", new { onDuty = true });
        Assert.IsTrue(status.OnDuty);

        var mine = await rider.GetAsync<List<object>>($"{Orders}/deliveries/mine?{Version}");
        Assert.IsEmpty(mine);

        var till = Suite.Ordering.As(Persona.Cashier(Delivering), Delivering);
        var riders = await till.GetAsync<List<RiderStatusView>>($"{Orders}/riders?{Version}");
        Assert.IsTrue(riders.Any(r => r.UserId == status.UserId && r.OnDuty), "the till sees the rider on duty");
    }

    [TestMethod]
    public async Task Riders_and_the_till_each_have_their_own_doors()
    {
        var customer = Customer($"customer-{Guid.NewGuid():N}");
        var rider = Suite.Ordering.As(Persona.Rider(Delivering), Delivering);
        var till = Suite.Ordering.As(Persona.Cashier(Delivering), Delivering);

        var (customerToRider, _) = await customer.RefusedAsync(HttpMethod.Get, $"{Orders}/deliveries/mine?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, customerToRider);

        var (tillMarksOut, _) = await till.RefusedAsync(HttpMethod.Put, $"{Orders}/1/delivery/out?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, tillMarksOut, "only a rider (or an admin standing in) says it left");

        var (riderAssigns, _) = await rider.RefusedAsync(HttpMethod.Put, $"{Orders}/1/delivery/rider?{Version}", new { riderUserId = "x", riderName = "x" });
        Assert.AreEqual(HttpStatusCode.Forbidden, riderAssigns, "a rider does not hand out deliveries");

        var (riderBoard, _) = await rider.RefusedAsync(HttpMethod.Get, $"{Orders}/deliveries?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, riderBoard);

        var (nothingThere, _) = await rider.RefusedAsync(HttpMethod.Put, $"{Orders}/999999/delivery/out?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, nothingThere);
    }
}

public record RiderStatusView(string UserId, string Name, bool OnDuty, int Out);
