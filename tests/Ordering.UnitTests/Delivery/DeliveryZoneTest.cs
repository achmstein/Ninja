namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Deliveries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.ServiceDefaults;

/// <summary>
/// A branch's named delivery areas ("Zamalek, 30"): each says what is different there, and the
/// branch's own reach and fee hold everywhere else. Picked by name at the till, found by the pin for
/// a customer when the area is drawn, and kept on the order as it was when placed.
/// </summary>
[TestClass]
public class DeliveryZoneTest
{
    private const int Downtown = 1;
    private const int Zamalek = 11, FarTown = 12, Zahraa = 13, Rainy = 14, Later = 15;

    // Downtown: 5 km round it, 20 a delivery, 50 the least
    private const double BranchLat = 30.0444, BranchLng = 31.2357;

    private static readonly double[][] ZamalekShape = [[30.055, 31.215], [30.070, 31.215], [30.070, 31.230], [30.055, 31.230]];
    // Past the branch's 5 km: an area drawn there is somewhere it delivers too
    private static readonly double[][] FarShape = [[30.100, 31.200], [30.120, 31.200], [30.120, 31.240], [30.100, 31.240]];
    private static readonly double[][] RainyShape = [[30.020, 31.220], [30.035, 31.220], [30.035, 31.250], [30.020, 31.250]];

    private static readonly (double Lat, double Lng) InZamalek = (30.060, 31.220);
    private static readonly (double Lat, double Lng) InFarTown = (30.110, 31.220);
    private static readonly (double Lat, double Lng) InRainy = (30.030, 31.235);
    private static readonly (double Lat, double Lng) NoArea = (30.0444, 31.260);
    private static readonly (double Lat, double Lng) Nowhere = (30.200, 31.500);

    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());

    private static BranchDeliveryZoneData Zone(int id, string en, decimal fee, double[][]? shape = null, decimal? minimum = null, int? minutes = null, bool on = true, string? ar = null) =>
        new(id, new LocalizedText(en, ar), fee, minimum, minutes, on, shape, 0);

    private static readonly BranchDeliveryZoneData[] TheList =
    [
        Zone(Zamalek, "Zamalek", 30, ZamalekShape, minimum: 120, minutes: 40, ar: "الزمالك"),
        Zone(FarTown, "Far Town", 60, FarShape),
        Zone(Zahraa, "Zahraa", 35),
        Zone(Rainy, "Rainy", 25, RainyShape, on: false),
        // Drawn over Zamalek, later in the owner's list: Zamalek is the area there
        Zone(Later, "Later", 99, ZamalekShape),
    ];

    private static async Task<OrderingContext> ContextAsync(IReadOnlyList<BranchDeliveryZoneData>? zones = null, long version = 10)
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        await new BranchSettingsChangedIntegrationEventHandler(context, NullLogger<BranchSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchSettingsChangedIntegrationEvent(
                Downtown, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: BranchLat, Longitude: BranchLng, DeliveryRadiusKm: 5, DeliveryFee: 20, DeliveryMinimumOrder: 50));
        await SayAsync(context, zones ?? TheList, version);
        return context;
    }

    private static Task SayAsync(OrderingContext context, IReadOnlyList<BranchDeliveryZoneData> zones, long version) =>
        new BranchDeliveryZonesChangedIntegrationEventHandler(context, NullLogger<BranchDeliveryZonesChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchDeliveryZonesChangedIntegrationEvent(Downtown, [.. zones.Select((z, i) => z with { SortOrder = i })], version));

    private static DefaultHttpContext AtDowntown()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers[BranchHeaderExtensions.HeaderName] = Downtown.ToString();
        return http;
    }

    private static DeliveryDraft Draft((double Lat, double Lng)? pin, int? zoneId = null) =>
        new(pin?.Lat, pin?.Lng, "Somewhere St", Phone: "01001234567", ZoneId: zoneId);

    // --- The list reaches Ordering ---------------------------------------------

    [TestMethod]
    public async Task The_list_rides_its_own_event_into_the_terms_in_the_owner_s_order()
    {
        await using var context = await ContextAsync();

        var terms = (await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Downtown))!;

        CollectionAssert.AreEqual(new[] { Zamalek, FarTown, Zahraa, Rainy, Later }, terms.NamedZones.Select(z => z.Id).ToArray());
        Assert.AreEqual("الزمالك", terms.ZoneById(Zamalek)!.Name.Ar);
        Assert.AreEqual(120m, terms.MinimumIn(terms.ZoneById(Zamalek)));
        Assert.AreEqual(50m, terms.MinimumIn(terms.ZoneById(Zahraa)), "none of its own: the branch's");
        Assert.IsNull(terms.ZoneById(Zahraa)!.Shape, "only a name");
        Assert.AreEqual(20m, terms.FeeIn(null));
    }

    [TestMethod]
    public async Task A_newer_list_replaces_the_one_held_and_an_older_one_is_dropped()
    {
        await using var context = await ContextAsync(version: 10);
        var queries = new BranchSettingsQueries(context);

        await SayAsync(context, [Zone(Zahraa, "Zahraa", 40)], version: 20);
        Assert.AreEqual(40m, (await queries.GetDeliveryTermsAsync(Downtown))!.NamedZones.Single().Fee);

        await SayAsync(context, TheList, version: 15);
        Assert.HasCount(1, (await queries.GetDeliveryTermsAsync(Downtown))!.NamedZones, "a list from before the one held changes nothing");

        await SayAsync(context, [], version: 30);
        Assert.IsEmpty((await queries.GetDeliveryTermsAsync(Downtown))!.NamedZones, "an emptied list: the branch's own terms everywhere again");
    }

    // --- Where a point is ------------------------------------------------------

    [TestMethod]
    public async Task A_point_is_in_the_first_area_of_the_list_that_takes_it_in()
    {
        await using var context = await ContextAsync();
        var terms = (await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Downtown))!;

        Assert.AreEqual(Zamalek, terms.ZoneAt(InZamalek.Lat, InZamalek.Lng)!.Id, "not the one drawn over it later in the list");
        Assert.AreEqual(Rainy, terms.ZoneAt(InRainy.Lat, InRainy.Lng)!.Id, "an area switched off is still the area there");
        Assert.IsNull(terms.ZoneAt(NoArea.Lat, NoArea.Lng));
        Assert.IsTrue(terms.Covers(NoArea.Lat, NoArea.Lng), "the branch's own reach holds where no area is");
        Assert.IsTrue(terms.Covers(InFarTown.Lat, InFarTown.Lng), "an area drawn past the reach is delivered to");
        Assert.IsFalse(terms.Covers(Nowhere.Lat, Nowhere.Lng));
    }

    // --- The customer: found by the pin ------------------------------------------

    [TestMethod]
    public async Task The_customer_s_quote_is_the_area_s_where_the_pin_is_in_one()
    {
        await using var context = await ContextAsync();
        var queries = new BranchSettingsQueries(context);
        async Task<DeliveryQuote> QuoteAsync((double Lat, double Lng) at) =>
            ((Ok<DeliveryQuote>)(await DeliveryApi.GetDeliveryQuoteAsync(at.Lat, at.Lng, AtDowntown(), queries)).Result).Value!;

        var zamalek = await QuoteAsync(InZamalek);
        Assert.AreEqual(30m, zamalek.Fee);
        Assert.AreEqual(120m, zamalek.MinimumOrder);
        Assert.AreEqual(Zamalek, zamalek.ZoneId);
        Assert.AreEqual("Zamalek", zamalek.ZoneName!.En);
        Assert.AreEqual(40, zamalek.EtaMinutes);
        Assert.IsFalse(zamalek.ZoneOff);

        var plain = await QuoteAsync(NoArea);
        Assert.AreEqual(20m, plain.Fee);
        Assert.AreEqual(50m, plain.MinimumOrder);
        Assert.IsNull(plain.ZoneId);

        var far = await QuoteAsync(InFarTown);
        Assert.IsTrue(far.InRange);
        Assert.AreEqual(60m, far.Fee);

        var rainy = await QuoteAsync(InRainy);
        Assert.IsTrue(rainy.ZoneOff, "the customer is told the branch is not delivering there right now");
        Assert.AreEqual("Rainy", rainy.ZoneName!.En);

        Assert.IsFalse((await QuoteAsync(Nowhere)).InRange);
    }

    [TestMethod]
    public async Task Resolve_gives_each_branch_what_it_asks_at_the_pin()
    {
        await using var context = await ContextAsync();

        var answer = ((Ok<DeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchAsync(InZamalek.Lat, InZamalek.Lng, new BranchSettingsQueries(context))).Result).Value!;

        var branch = answer.Branches.Single();
        Assert.AreEqual(30m, branch.Fee);
        Assert.AreEqual(120m, branch.MinimumOrder);
        Assert.AreEqual(Zamalek, branch.ZoneId);
    }

    [TestMethod]
    public async Task A_customer_s_order_is_held_to_the_area_and_keeps_it()
    {
        await using var context = await ContextAsync();
        var policy = new DeliveryPolicy(new BranchSettingsQueries(context), Egypt);

        var small = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(Draft(InZamalek), Downtown, DeliveryTaker.Customer, null, 100));
        Assert.AreEqual(DeliveryErrors.BelowMinimum, small.Code, "100 clears the branch's 50, not Zamalek's 120");

        var placed = await policy.BuildAsync(Draft(InZamalek), Downtown, DeliveryTaker.Customer, null, 150);
        Assert.AreEqual(30m, placed.Fee);
        Assert.AreEqual(Zamalek, placed.ZoneId);
        Assert.AreEqual("Zamalek", placed.ZoneName!.En);
        Assert.AreEqual("الزمالك", placed.ZoneName.Ar);
        Assert.AreEqual(40, placed.EtaMinutes);
        Assert.AreEqual(120m, placed.MinimumOrder, "what it was held to, for the check at the menu's prices");

        var plain = await policy.BuildAsync(Draft(NoArea), Downtown, DeliveryTaker.Customer, null, 60);
        Assert.AreEqual(20m, plain.Fee);
        Assert.IsNull(plain.ZoneId);
        Assert.IsNull(plain.ZoneName);
        Assert.AreEqual(50m, plain.MinimumOrder);

        var off = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(Draft(InRainy), Downtown, DeliveryTaker.Customer, null, 500));
        Assert.AreEqual(DeliveryErrors.ZoneOff, off.Code);
        StringAssert.Contains(off.Message, "Rainy");

        var named = await policy.BuildAsync(Draft(NoArea, zoneId: Zahraa), Downtown, DeliveryTaker.Customer, null, 60);
        Assert.IsNull(named.ZoneId, "a customer's area is read from their pin, never taken from what they send");
        Assert.AreEqual(20m, named.Fee);
    }

    // --- The till: picked by name ----------------------------------------------------

    [TestMethod]
    public async Task The_till_picks_an_area_by_name_with_no_pin_at_all()
    {
        await using var context = await ContextAsync();
        var policy = new DeliveryPolicy(new BranchSettingsQueries(context), Egypt);

        var zahraa = await policy.BuildAsync(Draft(null, zoneId: Zahraa), Downtown, DeliveryTaker.Till, null, 10);
        Assert.AreEqual(35m, zahraa.Fee);
        Assert.AreEqual(Zahraa, zahraa.ZoneId);
        Assert.AreEqual("Zahraa", zahraa.ZoneName!.En);
        Assert.IsNull(zahraa.EtaMinutes);

        var rainy = await policy.BuildAsync(Draft(null, zoneId: Rainy), Downtown, DeliveryTaker.Till, null, 10);
        Assert.AreEqual(25m, rainy.Fee, "the cashier was asked twice; the till is not held to the switch");

        var byPin = await policy.BuildAsync(Draft(InZamalek), Downtown, DeliveryTaker.Till, null, 10);
        Assert.AreEqual(Zamalek, byPin.ZoneId, "a pin the till has still finds its area");

        var pickedOverPin = await policy.BuildAsync(Draft(InZamalek, zoneId: Zahraa), Downtown, DeliveryTaker.Till, null, 10);
        Assert.AreEqual(Zahraa, pickedOverPin.ZoneId, "the cashier's own pick comes first");

        var gone = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(Draft(null, zoneId: 999), Downtown, DeliveryTaker.Till, null, 10));
        Assert.AreEqual(DeliveryErrors.ZoneUnknown, gone.Code);
    }

    [TestMethod]
    public async Task The_till_s_quote_prices_the_area_picked_and_lists_the_branch_s_areas()
    {
        await using var context = await ContextAsync();
        var queries = new BranchSettingsQueries(context);

        var plain = (await DeliveryApi.GetTillDeliveryQuoteAsync(AtDowntown(), queries, null!)).Value!;
        Assert.AreEqual(20m, plain.Fee);
        Assert.IsNull(plain.ZoneId);
        CollectionAssert.AreEqual(new[] { Zamalek, FarTown, Zahraa, Rainy, Later }, plain.Zones!.Select(z => z.ZoneId).ToArray());
        Assert.AreEqual(50m, plain.Zones!.Single(z => z.ZoneId == Zahraa).MinimumOrder, "what holds there, said outright");
        Assert.IsFalse(plain.Zones!.Single(z => z.ZoneId == Rainy).On);
        Assert.IsTrue(plain.Zones!.Single(z => z.ZoneId == Zamalek).Drawn);
        Assert.IsFalse(plain.Zones!.Single(z => z.ZoneId == Zahraa).Drawn);

        var picked = (await DeliveryApi.GetTillDeliveryQuoteAsync(AtDowntown(), queries, null!, zoneId: Zamalek)).Value!;
        Assert.AreEqual(30m, picked.Fee);
        Assert.AreEqual(120m, picked.MinimumOrder);
        Assert.AreEqual(40, picked.EtaMinutes);
        Assert.AreEqual("Zamalek", picked.ZoneName!.En);
    }

    [TestMethod]
    public async Task The_call_centre_gets_every_branch_s_areas_and_the_one_a_pin_is_in()
    {
        await using var context = await ContextAsync();
        var queries = new BranchSettingsQueries(context);

        var none = ((Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(queries, null!)).Result).Value!;
        var zahraa = none.Zones!.Single(z => z.ZoneId == Zahraa);
        Assert.AreEqual(Downtown, zahraa.BranchId, "the area says which branch: one pick, and the agent has both");
        Assert.AreEqual(35m, zahraa.Fee);
        Assert.IsFalse(zahraa.BranchPaused);

        var pinned = ((Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(
            queries, null!, latitude: InZamalek.Lat, longitude: InZamalek.Lng)).Result).Value!;
        var offer = pinned.Branches.Single();
        Assert.AreEqual(Zamalek, offer.ZoneId);
        Assert.AreEqual(30m, offer.Fee);
        Assert.AreEqual(120m, offer.MinimumOrder);
        Assert.IsFalse(offer.ZoneOff);
    }

    [TestMethod]
    public async Task A_branch_with_no_areas_is_as_it_was()
    {
        await using var context = await ContextAsync([]);
        var queries = new BranchSettingsQueries(context);

        var terms = (await queries.GetDeliveryTermsAsync(Downtown))!;
        Assert.IsNull(terms.Zones);
        var quote = ((Ok<DeliveryQuote>)(await DeliveryApi.GetDeliveryQuoteAsync(InZamalek.Lat, InZamalek.Lng, AtDowntown(), queries)).Result).Value!;
        Assert.AreEqual(20m, quote.Fee);
        Assert.IsNull(quote.ZoneId);
        Assert.IsFalse(terms.Covers(InFarTown.Lat, InFarTown.Lng), "past the 5 km with no area drawn there");
    }
}
