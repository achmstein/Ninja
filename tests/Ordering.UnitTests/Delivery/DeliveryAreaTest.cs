namespace Ninja.Ordering.UnitTests.Application;

using System.Net.Http;
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
/// A delivery area drawn on the map: whether a point is inside it, and that a
/// drawn area, not the radius, decides where the branch delivers at every place
/// that asks (the customer's quote, resolve, the till's quote, the policy and the
/// alternatives).
/// </summary>
[TestClass]
public class DeliveryAreaTest
{
    private const int Downtown = 1;
    private const int Maadi = 2;
    private static readonly DateTime Noon = new(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);

    // Downtown, with a 5 km radius and an area drawn north-west of it, up past Zamalek
    private const double BranchLat = 30.0444, BranchLng = 31.2357;
    private static readonly double[][] NorthWest = [[30.040, 31.200], [30.100, 31.200], [30.100, 31.240], [30.040, 31.240]];

    // About 6 km out: past the radius, inside the area
    private const double FarInsideLat = 30.095, FarInsideLng = 31.210;

    // Garden City, about a kilometre south: within the radius, south of the area
    private const double NearOutsideLat = 30.0350, NearOutsideLng = 31.2320;

    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());

    // --- Geo.Contains -------------------------------------------------------

    private static readonly double[][] Square = [[0, 0], [0, 10], [10, 10], [10, 0]];

    [TestMethod]
    public void A_point_inside_a_square_is_in_and_one_outside_is_not()
    {
        Assert.IsTrue(Geo.Contains(Square, 5, 5));
        Assert.IsFalse(Geo.Contains(Square, 15, 5));
        Assert.IsFalse(Geo.Contains(Square, 5, -1));
        Assert.IsFalse(Geo.Contains(Square, -0.001, 5));
    }

    [TestMethod]
    public void A_point_on_an_edge_or_a_corner_is_in()
    {
        Assert.IsTrue(Geo.Contains(Square, 0, 5));
        Assert.IsTrue(Geo.Contains(Square, 10, 5));
        Assert.IsTrue(Geo.Contains(Square, 5, 10));
        Assert.IsTrue(Geo.Contains(Square, 0, 0));
        Assert.IsTrue(Geo.Contains(Square, 10, 10));
    }

    [TestMethod]
    public void A_ray_through_a_corner_is_counted_once()
    {
        // A diamond: a point level with its side corners, inside and outside
        double[][] diamond = [[0, 5], [5, 10], [10, 5], [5, 0]];
        Assert.IsTrue(Geo.Contains(diamond, 5, 5));
        Assert.IsFalse(Geo.Contains(diamond, 5, 11));
        Assert.IsFalse(Geo.Contains(diamond, 5, -1));
    }

    [TestMethod]
    public void The_notch_of_a_concave_area_is_out()
    {
        // A U open to the north: two arms and the base between them
        double[][] u = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10]];

        Assert.IsTrue(Geo.Contains(u, 8, 1.5), "the western arm");
        Assert.IsTrue(Geo.Contains(u, 8, 8.5), "the eastern arm");
        Assert.IsTrue(Geo.Contains(u, 1.5, 5), "the base");
        Assert.IsFalse(Geo.Contains(u, 8, 5), "the notch between the arms");
    }

    [TestMethod]
    public void A_ring_drawn_closed_reads_the_same_and_too_few_points_enclose_nothing()
    {
        double[][] closed = [.. Square, [0, 0]];
        Assert.IsTrue(Geo.Contains(closed, 5, 5));
        Assert.IsFalse(Geo.Contains(closed, 15, 5));
        Assert.IsFalse(Geo.Contains([[0, 0], [10, 10]], 5, 5));
    }

    // --- DeliveryTerms.Covers -------------------------------------------------

    private static readonly DeliveryTerms Radius = new(BranchLat, BranchLng, 5, 20, 0);
    private static readonly DeliveryTerms Drawn = Radius with { Area = NorthWest };

    [TestMethod]
    public void The_points_are_where_the_tests_say()
    {
        Assert.IsGreaterThan(Radius.RadiusMeters, Radius.DistanceTo(FarInsideLat, FarInsideLng));
        Assert.IsLessThan(Radius.RadiusMeters, Radius.DistanceTo(NearOutsideLat, NearOutsideLng));
    }

    [TestMethod]
    public void Without_an_area_the_radius_decides()
    {
        Assert.IsFalse(Radius.HasArea);
        Assert.IsFalse(Radius.Covers(FarInsideLat, FarInsideLng));
        Assert.IsTrue(Radius.Covers(NearOutsideLat, NearOutsideLng));
    }

    [TestMethod]
    public void A_drawn_area_wins_over_the_radius()
    {
        Assert.IsTrue(Drawn.HasArea);
        Assert.IsTrue(Drawn.Covers(FarInsideLat, FarInsideLng));
        Assert.IsFalse(Drawn.Covers(NearOutsideLat, NearOutsideLng));
    }

    [TestMethod]
    public void A_branch_with_only_an_area_delivers_inside_it()
    {
        var areaOnly = Drawn with { RadiusKm = 0 };
        Assert.IsTrue(areaOnly.Covers(FarInsideLat, FarInsideLng));
        Assert.IsFalse(areaOnly.Covers(NearOutsideLat, NearOutsideLng));
    }

    // --- From the event to every place that asks --------------------------------

    private static async Task<OrderingContext> ContextAsync(double[][]? area, decimal? radiusKm = 5)
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        await new BranchSettingsChangedIntegrationEventHandler(context, NullLogger<BranchSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchSettingsChangedIntegrationEvent(
                Downtown, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: BranchLat, Longitude: BranchLng, DeliveryRadiusKm: radiusKm, DeliveryFee: 20,
                DeliveryArea: area) { CreationDate = Noon });
        return context;
    }

    private static DefaultHttpContext AtDowntown()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers[BranchHeaderExtensions.HeaderName] = Downtown.ToString();
        return http;
    }

    [TestMethod]
    public async Task The_area_rides_the_branch_event_into_the_terms()
    {
        await using var context = await ContextAsync(NorthWest);

        var terms = await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Downtown);

        Assert.IsNotNull(terms);
        Assert.AreEqual(4, terms.Area!.Count);
        CollectionAssert.AreEqual(NorthWest[2], terms.Area[2]);
    }

    [TestMethod]
    public async Task A_branch_with_an_area_and_no_radius_delivers()
    {
        await using var context = await ContextAsync(NorthWest, radiusKm: null);
        var queries = new BranchSettingsQueries(context);

        var terms = await queries.GetDeliveryTermsAsync(Downtown);
        var delivering = await queries.GetDeliveringBranchesAsync();

        Assert.IsNotNull(terms);
        Assert.AreEqual(0m, terms.RadiusKm);
        Assert.AreEqual(Downtown, delivering.Single().BranchId);
    }

    [TestMethod]
    public async Task An_event_without_the_area_takes_it_away()
    {
        await using var context = await ContextAsync(NorthWest);
        await new BranchSettingsChangedIntegrationEventHandler(context, NullLogger<BranchSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchSettingsChangedIntegrationEvent(
                Downtown, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: BranchLat, Longitude: BranchLng, DeliveryRadiusKm: 5, DeliveryFee: 20) { CreationDate = Noon.AddMinutes(1) });

        var terms = await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Downtown);

        Assert.IsFalse(terms!.HasArea);
    }

    [TestMethod]
    public async Task The_customers_quote_follows_the_area()
    {
        await using var context = await ContextAsync(NorthWest);
        var queries = new BranchSettingsQueries(context);

        var far = (Ok<DeliveryQuote>)(await DeliveryApi.GetDeliveryQuoteAsync(FarInsideLat, FarInsideLng, AtDowntown(), queries)).Result;
        var near = (Ok<DeliveryQuote>)(await DeliveryApi.GetDeliveryQuoteAsync(NearOutsideLat, NearOutsideLng, AtDowntown(), queries)).Result;

        Assert.IsTrue(far.Value!.InRange);
        Assert.IsFalse(near.Value!.InRange);
    }

    [TestMethod]
    public async Task Resolve_finds_the_branch_by_its_area()
    {
        await using var context = await ContextAsync(NorthWest);
        var queries = new BranchSettingsQueries(context);

        var far = (Ok<DeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchAsync(FarInsideLat, FarInsideLng, queries)).Result;
        var near = (Ok<DeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchAsync(NearOutsideLat, NearOutsideLng, queries)).Result;

        Assert.AreEqual(Downtown, far.Value!.Branches.Single().BranchId);
        Assert.IsEmpty(near.Value!.Branches);
    }

    [TestMethod]
    public async Task The_tills_quote_follows_the_area()
    {
        await using var context = await ContextAsync(NorthWest);
        var queries = new BranchSettingsQueries(context);
        var http = Substitute.For<IHttpClientFactory>();
        http.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient());

        var far = await DeliveryApi.GetTillDeliveryQuoteAsync(AtDowntown(), queries, http, FormattableString.Invariant($"{FarInsideLat}, {FarInsideLng}"));
        var near = await DeliveryApi.GetTillDeliveryQuoteAsync(AtDowntown(), queries, http, FormattableString.Invariant($"{NearOutsideLat}, {NearOutsideLng}"));

        Assert.IsTrue(far.Value!.LocationRead);
        Assert.IsTrue(far.Value.InRange);
        Assert.IsFalse(near.Value!.InRange);
    }

    [TestMethod]
    public async Task The_policy_holds_a_customer_to_the_area()
    {
        await using var context = await ContextAsync(NorthWest);
        var policy = new DeliveryPolicy(new BranchSettingsQueries(context), Egypt);

        var far = await policy.BuildAsync(new DeliveryDraft(FarInsideLat, FarInsideLng, "26th of July St", Phone: "01001234567"),
            Downtown, DeliveryTaker.Customer, null, 150);
        var refused = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(new DeliveryDraft(NearOutsideLat, NearOutsideLng, "Garden City", Phone: "01001234567"),
                Downtown, DeliveryTaker.Customer, null, 150));

        Assert.AreEqual(20m, far.Fee);
        Assert.AreEqual(DeliveryErrors.OutOfRange, refused.Code);
    }

    [TestMethod]
    public void Another_branchs_area_puts_it_among_the_alternatives()
    {
        // Maadi is far from the Zamalek street, but its drawn area reaches it; Downtown's radius does not
        var maadi = new DeliveryTerms(29.9602, 31.2569, 1, 25, 0, Area: NorthWest);

        var alternatives = DeliveryAlternatives.For(Downtown, Radius, FarInsideLat, FarInsideLng,
            [new BranchDeliveryTerms(Maadi, maadi)]);
        var notReached = DeliveryAlternatives.For(Downtown, Radius, NearOutsideLat, NearOutsideLng,
            [new BranchDeliveryTerms(Maadi, maadi with { RadiusKm = 20 })]);

        Assert.AreEqual(Maadi, alternatives.Single().BranchId);
        Assert.IsEmpty(notReached);
    }
}
