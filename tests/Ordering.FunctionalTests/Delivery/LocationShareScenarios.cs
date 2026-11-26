using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

/// <summary>
/// The location link: the till makes one for a caller on the phone, the caller's page (nobody signed
/// in) sends where their phone is, the till reads it, and an order placed with the link before the
/// caller shared takes the pin when it comes.
/// </summary>
[TestClass]
public sealed class LocationShareScenarios
{
    private const string Orders = "/api/orders";
    private const string Version = "api-version=1.0";

    /// <summary>A branch of its own, so its links touch no other scenario</summary>
    private const int Branch = 41;

    private static Caller Till => Suite.Ordering.As(Persona.Cashier(Branch), Branch);
    private static Caller OtherTill => Suite.Ordering.As(Persona.Cashier(Branch + 1), Branch + 1);

    private sealed record Created(string Token, DateTime ExpiresAt);
    private sealed record Shared(string Token, double? Latitude, double? Longitude, double? AccuracyMeters, DateTime? SharedAt, bool Expired);
    private sealed record State(bool Open, bool Shared);

    private static async Task BranchAsync()
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<BranchSettingsChangedIntegrationEventHandler>(scope.ServiceProvider).Handle(
            new BranchSettingsChangedIntegrationEvent(
                Branch, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: 30.0444, Longitude: 31.2357, DeliveryRadiusKm: 5, DeliveryFee: 20,
                Name: new("Garden City", "جاردن سيتي"), Address: new("Qasr El Aini St", "شارع القصر العيني"), Phone: "+20225550001"));
    }

    /// <summary>An order the till took by phone with the link, no pin yet: the words only</summary>
    private static async Task<int> PhoneOrderAsync(string token)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        var order = new Order(
            string.Empty, string.Empty, Branch, guestId: $"till-{Guid.NewGuid():N}", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Delivery(null, null, "Street 9", "12", "3", null, null, "01001234567", 20, null, locationShareToken: token));
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        context.Orders.Add(order);
        await context.SaveChangesAsync();
        return order.Id;
    }

    private static async Task<Delivery> DeliveryOfAsync(int orderId)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        return (await context.Orders.AsNoTracking().SingleAsync(o => o.Id == orderId)).Delivery!;
    }

    private static Task<HttpResponseMessage> ShareAsync(string token, object location) =>
        // The caller's page: nobody signed in, the link is the only key
        Suite.Ordering.CreateClient().PutAsJsonAsync($"{Orders}/delivery/location-shares/{token}?{Version}", location);

    [TestMethod]
    public async Task A_caller_shares_their_location_through_the_link_and_the_till_reads_it()
    {
        await BranchAsync();
        var link = await Till.PostAsync<Created>($"{Orders}/delivery/location-shares?{Version}");
        Assert.AreEqual(32, link.Token.Length);

        var before = await Suite.Ordering.CreateClient().GetFromJsonAsync<State>($"{Orders}/delivery/location-shares/{link.Token}/state?{Version}");
        Assert.AreEqual(new State(true, false), before);

        using var shared = await ShareAsync(link.Token, new { latitude = 30.0461, longitude = 31.2389, accuracyMeters = 12 });
        Assert.AreEqual(HttpStatusCode.NoContent, shared.StatusCode, await shared.Content.ReadAsStringAsync());

        var read = await Till.GetAsync<Shared>($"{Orders}/delivery/location-shares/{link.Token}?{Version}");
        Assert.AreEqual((30.0461, 31.2389, 12d), (read.Latitude, read.Longitude, read.AccuracyMeters));
        Assert.IsNotNull(read.SharedAt);

        // Another branch's till never reads it
        using var other = await OtherTill.RawAsync(HttpMethod.Get, $"{Orders}/delivery/location-shares/{link.Token}?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, other.StatusCode);
    }

    [TestMethod]
    public async Task A_location_shared_after_the_order_was_placed_becomes_its_pin()
    {
        await BranchAsync();
        var link = await Till.PostAsync<Created>($"{Orders}/delivery/location-shares?{Version}");
        var orderId = await PhoneOrderAsync(link.Token);
        Assert.AreEqual(DeliveryPinSource.None, (await DeliveryOfAsync(orderId)).PinSource);

        using var shared = await ShareAsync(link.Token, new { latitude = 30.0461, longitude = 31.2389 });
        Assert.AreEqual(HttpStatusCode.NoContent, shared.StatusCode);

        var delivery = await DeliveryOfAsync(orderId);
        Assert.AreEqual((30.0461, 31.2389), (delivery.Latitude, delivery.Longitude));
        Assert.AreEqual(DeliveryPinSource.Shared, delivery.PinSource);
        Assert.IsNotNull(delivery.DistanceMeters, "how far it is from the branch, now there is a pin");
    }

    [TestMethod]
    public async Task A_link_nobody_made_takes_nothing_and_a_point_off_the_map_is_refused()
    {
        await BranchAsync();
        using var unknown = await ShareAsync(new string('a', 32), new { latitude = 30.0, longitude = 31.0 });
        Assert.AreEqual(HttpStatusCode.NotFound, unknown.StatusCode);

        var link = await Till.PostAsync<Created>($"{Orders}/delivery/location-shares?{Version}");
        using var off = await ShareAsync(link.Token, new { latitude = 120.0, longitude = 31.0 });
        Assert.AreEqual(HttpStatusCode.BadRequest, off.StatusCode);
    }
}
