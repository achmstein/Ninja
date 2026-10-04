using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Deliveries;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

public record DeliveryQuoteView(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm);
public record QuoteWithSignIn(bool Delivers, bool SignInRequired);
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

    private static async Task<(HttpStatusCode Status, string Body)> PlaceAsync(Caller caller, object order, int? guestBranch = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{Orders}?{Version}")
        {
            Content = System.Net.Http.Json.JsonContent.Create(order, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", Guid.NewGuid().ToString());
        // A guest has no token: the branch and the device ride as headers
        if (guestBranch is { } branch)
        {
            request.Headers.Add("X-Branch-Id", branch.ToString());
            request.Headers.Add("X-Guest-Id", $"device-{Guid.NewGuid():N}");
        }
        using var response = await caller.Http.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    /// <summary>A branch of its own that delivers to signed-in customers only</summary>
    private const int AccountsOnly = 10;

    [TestMethod]
    public async Task A_branch_that_delivers_to_accounts_only_refuses_a_guest_and_takes_a_customer_and_the_till()
    {
        using (var scope = Suite.Ordering.Services.CreateScope())
        {
            var handler = ActivatorUtilities.CreateInstance<BranchSettingsChangedIntegrationEventHandler>(scope.ServiceProvider);
            await handler.Handle(new BranchSettingsChangedIntegrationEvent(
                AccountsOnly, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: Lat, Longitude: Lng, DeliveryRadiusKm: 5, DeliveryFee: 20, RequireSignInForDelivery: true));
        }

        var quote = await Customer($"customer-{Guid.NewGuid():N}", AccountsOnly)
            .GetAsync<QuoteWithSignIn>($"{Orders}/delivery/quote?latitude={NearLat}&longitude={NearLng}&{Version}");
        Assert.IsTrue(quote.SignInRequired, "the quote says so before the guest fills in an address");

        var guestOrder = new
        {
            guestName = "Mona",
            guestPhone = "01001234567",
            items = new[] { new { id = "1", productId = 1, productName = new { en = "Family meal" }, unitPrice = 150m, oldUnitPrice = 150m, quantity = 1 } },
            delivery = new { latitude = NearLat, longitude = NearLng, address = "Qasr El Nil St", phone = "01001234567" },
        };
        var (guest, guestBody) = await PlaceAsync(Suite.Ordering.AsAnonymous(), guestOrder, guestBranch: AccountsOnly);
        Assert.AreEqual(HttpStatusCode.BadRequest, guest, guestBody);
        Assert.Contains("delivery.sign_in_required", guestBody);

        var (customer, customerBody) = await PlaceAsync(Customer($"customer-{Guid.NewGuid():N}", AccountsOnly), Order(NearLat, NearLng, 150));
        Assert.AreEqual(HttpStatusCode.OK, customer, customerBody);

        var till = Suite.Ordering.As(Persona.Cashier(AccountsOnly), AccountsOnly);
        var (phone, phoneBody) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", phone = "01001234567" }));
        Assert.AreEqual(HttpStatusCode.OK, phone, phoneBody);
    }

    [TestMethod]
    public async Task A_branch_that_does_not_deliver_says_so_and_refuses_a_delivery()
    {
        var customer = Customer($"customer-{Guid.NewGuid():N}", NotDelivering);

        var quote = await customer.GetAsync<DeliveryQuoteView>($"{Orders}/delivery/quote?latitude={NearLat}&longitude={NearLng}&{Version}");
        Assert.IsFalse(quote.Delivers);

        var (status, body) = await PlaceAsync(customer, Order(NearLat, NearLng, 150));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("delivery.not_delivering", body);
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
        Assert.Contains("delivery.out_of_range", farBody);

        var (tooSmall, smallBody) = await PlaceAsync(customer, Order(NearLat, NearLng, 60));
        Assert.AreEqual(HttpStatusCode.BadRequest, tooSmall);
        Assert.Contains("delivery.below_minimum", smallBody);

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

    /// <summary>The till's own branch, paused for customers, so its scenario touches no other</summary>
    private const int PhoneOrders = 9;

    private static async Task<(HttpStatusCode Status, string Body)> RingUpAsync(Caller till, object order)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{Orders}/pos?{Version}")
        {
            Content = System.Net.Http.Json.JsonContent.Create(order, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", Guid.NewGuid().ToString());
        using var response = await till.Http.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static object PhoneOrder(object delivery, decimal price = 60, string? customerName = "Mona", int? ticketId = null) => new
    {
        customerName,
        ticketId,
        items = new[]
        {
            new { id = "1", productId = 1, productName = new { en = "Family meal", ar = "وجبة عائلية" }, unitPrice = price, oldUnitPrice = price, quantity = 1, pictureUrl = (string?)null },
        },
        delivery,
    };

    [TestMethod]
    public async Task The_till_takes_a_delivery_over_the_phone_without_a_pin_even_while_customers_are_paused()
    {
        using (var scope = Suite.Ordering.Services.CreateScope())
        {
            var handler = ActivatorUtilities.CreateInstance<BranchSettingsChangedIntegrationEventHandler>(scope.ServiceProvider);
            await handler.Handle(new BranchSettingsChangedIntegrationEvent(
                PhoneOrders, IsOrderingEnabled: false, IsReservationsEnabled: true, RequireSignInForTableOrders: false,
                IsDeliveryEnabled: true, Latitude: Lat, Longitude: Lng, DeliveryRadiusKm: 5, DeliveryFee: 20, DeliveryMinimumOrder: 100));
        }
        var till = Suite.Ordering.As(Persona.Cashier(PhoneOrders), PhoneOrders);
        var phone = $"010{Random.Shared.Next(10_000_000, 99_999_999)}";

        var quote = await till.GetAsync<TillQuoteView>($"{Orders}/delivery/till-quote?{Version}");
        Assert.IsTrue(quote.Delivers, "pausing the customers does not stop the till");
        Assert.IsTrue(quote.InRange, "without a pin the cashier knows the streets");
        Assert.IsNull(quote.DistanceMeters);
        Assert.AreEqual(20m, quote.Fee);

        // The location the caller shared, pasted as it came
        var shared = await till.GetAsync<TillQuoteView>(
            $"{Orders}/delivery/till-quote?location={Uri.EscapeDataString($"https://maps.google.com/?q={NearLat},{NearLng}")}&{Version}");
        Assert.AreEqual(NearLat, shared.Latitude);
        Assert.IsTrue(shared.InRange);
        Assert.IsTrue(shared.DistanceMeters is > 1000 and < 3000, $"{shared.DistanceMeters} m");

        var words = await till.GetAsync<TillQuoteView>($"{Orders}/delivery/till-quote?location=Maadi%20road%209&{Version}");
        Assert.IsFalse(words.LocationRead, "words are not a location");

        // Words only, under the minimum: the cashier's call, not the server's
        var (ok, okBody) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", building = "12", directions = "Blue gate", phone }));
        Assert.AreEqual(HttpStatusCode.OK, ok, okBody);

        // A pin past the radius goes too; the till warned
        var (far, farBody) = await RingUpAsync(till, PhoneOrder(new { address = "Maadi", phone, latitude = FarLat, longitude = FarLng }));
        Assert.AreEqual(HttpStatusCode.OK, far, farBody);

        var known = await till.GetAsync<List<KnownAddress>>($"{Orders}/delivery/known-addresses?phone={phone}&{Version}");
        CollectionAssert.AreEquivalent(new[] { "Maadi", "Qasr El Nil St" }, known.Select(a => a.Address).ToArray(), "the caller's doors, each once");
        Assert.IsNull(known.Single(a => a.Address == "Qasr El Nil St").Latitude);

        var (noName, noNameBody) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", phone }, customerName: null));
        Assert.AreEqual(HttpStatusCode.BadRequest, noName);
        Assert.Contains("delivery.name_required", noNameBody);

        var (onABill, _) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", phone }, ticketId: 1));
        Assert.AreEqual(HttpStatusCode.BadRequest, onABill, "a delivery is a bill of its own");

        var (badPhone, _) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", phone = "12" }));
        Assert.AreEqual(HttpStatusCode.BadRequest, badPhone);

        var (halfPin, _) = await RingUpAsync(till, PhoneOrder(new { address = "Qasr El Nil St", phone, latitude = NearLat }));
        Assert.AreEqual(HttpStatusCode.BadRequest, halfPin);

        var (notDelivering, _) = await RingUpAsync(
            Suite.Ordering.As(Persona.Cashier(NotDelivering), NotDelivering),
            PhoneOrder(new { address = "Qasr El Nil St", phone }));
        Assert.AreEqual(HttpStatusCode.BadRequest, notDelivering);
    }

    /// <summary>A refusal as it came: the whole ProblemDetails, code and all</summary>
    private static async Task<(HttpStatusCode Status, string Body)> ProblemAsync(Caller caller, HttpMethod method, string path, object? body = null)
    {
        using var response = await caller.RawAsync(method, path, body);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    /// <summary>Identity's word that an account is one of the branch's riders, as the bus would bring it</summary>
    private static async Task AnnounceRiderAsync(string userId, string name, int branch)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<StaffAccountChangedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new StaffAccountChangedIntegrationEvent(userId, name, ["Rider"], [branch], true));
    }

    /// <summary>A delivery the kitchen has confirmed, straight into the database: the menu check is another service's</summary>
    private static async Task<int> ConfirmedDeliveryAsync(decimal price = 60)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        var order = new Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order(
            string.Empty, string.Empty, Delivering, guestId: $"device-{Guid.NewGuid():N}", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery(NearLat, NearLng, "Qasr El Nil St", "12", null, null, null, "01001234567", 20, 2000));
        order.AddOrderItem(1, new() { En = "Family meal" }, price, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        context.Orders.Add(order);
        await context.SaveChangesAsync();
        return order.Id;
    }

    [TestMethod]
    public async Task A_delivery_goes_to_a_rider_out_of_the_door_and_its_cash_in_and_a_stale_move_is_told()
    {
        await DeliverFromTahrirAsync();
        var riderId = $"rider-{Guid.NewGuid():N}";
        await AnnounceRiderAsync(riderId, "Ali Hassan", Delivering);
        var id = await ConfirmedDeliveryAsync();
        var till = Suite.Ordering.As(Persona.Cashier(Delivering), Delivering);
        var rider = Suite.Ordering.As(Persona.Rider(Delivering, riderId), Delivering);

        // The name is Ordering's record of the rider, not what the till sends
        using (var given = await till.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/rider?{Version}", new { riderUserId = riderId, riderName = "Not their name" }))
        {
            Assert.AreEqual(HttpStatusCode.NoContent, given.StatusCode, await given.Content.ReadAsStringAsync());
        }

        var (stranger, strangerBody) = await ProblemAsync(till, HttpMethod.Put, $"{Orders}/{id}/delivery/rider?{Version}", new { riderUserId = "nobody-here" });
        Assert.AreEqual(HttpStatusCode.BadRequest, stranger);
        Assert.Contains("rider.unknown", strangerBody);

        var (early, earlyBody) = await ProblemAsync(till, HttpMethod.Put, $"{Orders}/{id}/delivery/cash-in?{Version}", new { amount = 140 });
        Assert.AreEqual(HttpStatusCode.Conflict, early, "not delivered yet");
        Assert.Contains("delivery.not_delivered", earlyBody);

        using (var left = await rider.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/out?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, left.StatusCode, await left.Content.ReadAsStringAsync());
        using (var arrived = await rider.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/delivered?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, arrived.StatusCode, await arrived.Content.ReadAsStringAsync());

        var otherRider = $"rider-{Guid.NewGuid():N}";
        await AnnounceRiderAsync(otherRider, "Omar", Delivering);
        var (late, lateBody) = await ProblemAsync(till, HttpMethod.Put, $"{Orders}/{id}/delivery/rider?{Version}", new { riderUserId = otherRider });
        Assert.AreEqual(HttpStatusCode.Conflict, late, "it has left");
        Assert.Contains("delivery.already_out", lateBody);

        using (var cash = await till.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/cash-in?{Version}", new { amount = 130 }))
            Assert.AreEqual(HttpStatusCode.NoContent, cash.StatusCode, await cash.Content.ReadAsStringAsync());

        var board = await till.GetAsync<List<BoardCard>>($"{Orders}/deliveries?{Version}");
        var card = board.Single(o => o.OrderNumber == id);
        Assert.AreEqual(140m, card.Total);
        Assert.AreEqual(-10m, card.CashDifference, "ten short");
        Assert.AreEqual("Ali Hassan", card.Delivery.RiderName);
    }

    [TestMethod]
    public async Task Two_tills_moving_the_same_delivery_at_once_the_second_is_told()
    {
        await DeliverFromTahrirAsync();
        var riderId = $"rider-{Guid.NewGuid():N}";
        await AnnounceRiderAsync(riderId, "Ali", Delivering);
        var id = await ConfirmedDeliveryAsync();

        using var first = Suite.Ordering.Services.CreateScope();
        using var second = Suite.Ordering.Services.CreateScope();
        var a = await first.ServiceProvider.GetRequiredService<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.IOrderRepository>().GetAsync(id);
        var secondRepository = second.ServiceProvider.GetRequiredService<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.IOrderRepository>();
        var b = await secondRepository.GetAsync(id);

        a.AssignRider(riderId, "Ali");
        await first.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>().SaveChangesAsync();

        b.AssignRider("someone-else", "Omar");
        await Assert.ThrowsExactlyAsync<Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException>(
            () => second.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>().SaveChangesAsync());
    }

    [TestMethod]
    public async Task A_rider_sees_their_own_deliveries_and_the_till_its_riders()
    {
        var riderId = $"rider-{Guid.NewGuid():N}";
        await AnnounceRiderAsync(riderId, "Rider", Delivering);
        var rider = Suite.Ordering.As(Persona.Rider(Delivering, riderId), Delivering);

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

        // The till may say it left or arrived for a rider whose phone cannot;
        // the door lets it in (the order here is none, so: not found)
        var (tillMarksOut, _) = await till.RefusedAsync(HttpMethod.Put, $"{Orders}/999999/delivery/out?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, tillMarksOut, "the till stands in for its riders");

        var (customerMarksOut, _) = await customer.RefusedAsync(HttpMethod.Put, $"{Orders}/999999/delivery/out?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, customerMarksOut, "a customer never says it left");

        var (riderAssigns, _) = await rider.RefusedAsync(HttpMethod.Put, $"{Orders}/1/delivery/rider?{Version}", new { riderUserId = "x", riderName = "x" });
        Assert.AreEqual(HttpStatusCode.Forbidden, riderAssigns, "a rider does not hand out deliveries");

        var (riderBoard, _) = await rider.RefusedAsync(HttpMethod.Get, $"{Orders}/deliveries?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, riderBoard);

        var (nothingThere, _) = await rider.RefusedAsync(HttpMethod.Put, $"{Orders}/999999/delivery/out?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, nothingThere);
    }

    [TestMethod]
    public async Task The_admin_sees_who_rides_now_each_riders_deliveries_and_every_step_of_one()
    {
        await DeliverFromTahrirAsync();
        var aliId = $"rider-{Guid.NewGuid():N}";
        var omarId = $"rider-{Guid.NewGuid():N}";
        await AnnounceRiderAsync(aliId, "Ali", Delivering);
        await AnnounceRiderAsync(omarId, "Omar", Delivering);
        var id = await ConfirmedDeliveryAsync();
        var till = Suite.Ordering.As(Persona.Cashier(Delivering), Delivering);
        var omar = Suite.Ordering.As(Persona.Rider(Delivering, omarId), Delivering);
        var admin = Suite.Ordering.As(Persona.Admin(Delivering), Delivering);

        // Given to Ali, then to Omar before it left; Omar takes it, the till counts the cash in
        using (var given = await till.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/rider?{Version}", new { riderUserId = aliId }))
            Assert.AreEqual(HttpStatusCode.NoContent, given.StatusCode, await given.Content.ReadAsStringAsync());
        using (var regiven = await till.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/rider?{Version}", new { riderUserId = omarId }))
            Assert.AreEqual(HttpStatusCode.NoContent, regiven.StatusCode, await regiven.Content.ReadAsStringAsync());
        using (var onDuty = await omar.RawAsync(HttpMethod.Put, $"{Orders}/riders/me?{Version}", new { onDuty = true }))
            Assert.IsTrue(onDuty.IsSuccessStatusCode, await onDuty.Content.ReadAsStringAsync());
        using (var left = await omar.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/out?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, left.StatusCode, await left.Content.ReadAsStringAsync());
        using (var arrived = await omar.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/delivered?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, arrived.StatusCode, await arrived.Content.ReadAsStringAsync());
        using (var cash = await till.RawAsync(HttpMethod.Put, $"{Orders}/{id}/delivery/cash-in?{Version}", new { amount = 135 }))
            Assert.AreEqual(HttpStatusCode.NoContent, cash.StatusCode, await cash.Content.ReadAsStringAsync());

        var overview = await admin.GetAsync<List<RiderOverviewView>>($"{Orders}/riders/overview?tzOffsetMinutes=0&{Version}");
        var omarNow = overview.Single(r => r.UserId == omarId);
        Assert.AreEqual("Online", omarNow.Status);
        Assert.AreEqual(1, omarNow.DeliveredToday);
        Assert.AreEqual(135m, omarNow.CashCollectedToday);
        Assert.AreEqual("Off", overview.Single(r => r.UserId == aliId).Status);
        Assert.IsTrue(overview.FindIndex(r => r.UserId == omarId) < overview.FindIndex(r => r.UserId == aliId), "online first");

        // Ali's history keeps the one taken from him, given to Omar; it counts nothing for him
        var aliHistory = await admin.GetAsync<RiderHistoryView>($"{Orders}/riders/{aliId}/deliveries?{Version}");
        var taken = aliHistory.Items.Single(i => i.OrderNumber == id);
        Assert.AreEqual("GivenToOther", taken.Stage);
        Assert.AreEqual("Omar", taken.GivenToRiderName);
        Assert.AreEqual(0, aliHistory.Summary.Delivered);

        var omarHistory = await admin.GetAsync<RiderHistoryView>($"{Orders}/riders/{omarId}/deliveries?{Version}");
        var mine = omarHistory.Items.Single(i => i.OrderNumber == id);
        Assert.AreEqual("Delivered", mine.Stage);
        Assert.AreEqual(1, omarHistory.Summary.Delivered);
        Assert.AreEqual(135m, omarHistory.Summary.CashCollected);

        // Every step, in order, with who took it
        var timeline = await till.GetAsync<List<TimelineStepView>>($"{Orders}/{id}/delivery/timeline?{Version}");
        CollectionAssert.AreEqual(
            new[] { "Assigned", "Reassigned", "Out", "Delivered", "CashIn" },
            timeline.Select(s => s.Action).ToArray());
        Assert.AreEqual("Till", timeline[0].ActorRole);
        Assert.AreEqual(aliId, timeline[1].PreviousRiderUserId);
        Assert.AreEqual("Ali", timeline[1].PreviousRiderName);
        Assert.AreEqual("Rider", timeline[2].ActorRole);
        Assert.AreEqual(omarId, timeline[2].ActorUserId);
        Assert.AreEqual(135m, timeline[4].CashCollected);
        Assert.HasCount(5, await admin.GetAsync<List<TimelineStepView>>($"{Orders}/{id}/delivery/timeline?{Version}"), "the admin reads it too");

        // Another branch's till finds no such delivery
        var elsewhere = Suite.Ordering.As(Persona.Cashier(NotDelivering), NotDelivering);
        var (otherBranch, _) = await elsewhere.RefusedAsync(HttpMethod.Get, $"{Orders}/{id}/delivery/timeline?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, otherBranch);

        // A window must start before it ends, and span 93 days at most
        var (backwards, backwardsBody) = await ProblemAsync(admin, HttpMethod.Get, $"{Orders}/riders/{omarId}/deliveries?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z&{Version}");
        Assert.AreEqual(HttpStatusCode.BadRequest, backwards);
        Assert.Contains("riders.range_invalid", backwardsBody);
        var (tooWide, _) = await ProblemAsync(admin, HttpMethod.Get, $"{Orders}/riders/{omarId}/deliveries?from=2026-01-01T00:00:00Z&to=2026-06-01T00:00:00Z&{Version}");
        Assert.AreEqual(HttpStatusCode.BadRequest, tooWide);
        var (badZone, badZoneBody) = await ProblemAsync(admin, HttpMethod.Get, $"{Orders}/riders/overview?tzOffsetMinutes=5000&{Version}");
        Assert.AreEqual(HttpStatusCode.BadRequest, badZone);
        Assert.Contains("riders.tz_invalid", badZoneBody);

        // Neither a customer nor a rider reads them; the till reads no rider's history
        var customer = Customer($"customer-{Guid.NewGuid():N}");
        foreach (var caller in new[] { customer, omar })
        {
            Assert.AreEqual(HttpStatusCode.Forbidden, (await caller.RefusedAsync(HttpMethod.Get, $"{Orders}/riders/overview?{Version}")).Item1);
            Assert.AreEqual(HttpStatusCode.Forbidden, (await caller.RefusedAsync(HttpMethod.Get, $"{Orders}/riders/{omarId}/deliveries?{Version}")).Item1);
            Assert.AreEqual(HttpStatusCode.Forbidden, (await caller.RefusedAsync(HttpMethod.Get, $"{Orders}/{id}/delivery/timeline?{Version}")).Item1);
        }

        Assert.AreEqual(HttpStatusCode.Forbidden, (await till.RefusedAsync(HttpMethod.Get, $"{Orders}/riders/{omarId}/deliveries?{Version}")).Item1);
    }
}

public record RiderOverviewView(string UserId, string Name, string Status, int Out, int DeliveredToday, decimal CashCollectedToday);

public record RiderHistoryRowView(int OrderNumber, string Stage, string? GivenToRiderName);

public record RiderHistorySummaryView(int Delivered, decimal CashCollected);

public record RiderHistoryView(List<RiderHistoryRowView> Items, int TotalCount, RiderHistorySummaryView Summary);

public record TimelineStepView(string Action, string? PreviousRiderUserId, string? PreviousRiderName, string? ActorUserId, string ActorRole, decimal? CashCollected);

public record RiderStatusView(string UserId, string Name, bool OnDuty, int Out);

public record BoardDelivery(string? RiderName, string Stage);

public record BoardCard(int OrderNumber, decimal Total, decimal? CashDifference, BoardDelivery Delivery);

public record TillQuoteView(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm, double? Latitude, double? Longitude, bool LocationRead);

public record KnownAddress(string? Label, double? Latitude, double? Longitude, string Address, string? Building, string? Phone, DateTime? LastDeliveredAt);
