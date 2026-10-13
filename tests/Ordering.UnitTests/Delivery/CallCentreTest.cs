namespace Ninja.Ordering.UnitTests.Application;

using System.Net.Http;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Deliveries;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;
using Ninja.ServiceDefaults;

/// <summary>
/// A business with a call centre: the hotline asks which branch delivers to the
/// caller (paused ones flagged), and a branch till stops offering to send its
/// phone orders elsewhere. And the till's quote says when a branch has a drawn
/// area, so it does not speak of a "0 km" radius.
/// </summary>
[TestClass]
public class CallCentreTest
{
    // Downtown and Maadi, 9 km apart; the caller is a few hundred metres from Maadi
    private const int Downtown = 1;
    private const int Maadi = 2;
    private const int Zamalek = 3;
    private static readonly DeliveryTerms DowntownTerms = new(30.0444, 31.2357, 12, 20, 0);
    private static readonly DeliveryTerms MaadiTerms = new(29.9602, 31.2569, 6, 25, 100);
    private static readonly DeliveryTerms ZamalekTerms = new(30.0609, 31.2197, 3, 15, 0);
    private const double CallerLat = 29.9650, CallerLng = 31.2550;

    private static readonly double[][] AroundDowntown = [[30.00, 31.20], [30.08, 31.20], [30.08, 31.27], [30.00, 31.27]];

    private static OrderingContext ContextWith(bool? callCentre, params BranchSettings[] rows)
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        context.BranchSettings.AddRange(rows);
        if (callCentre is { } on)
        {
            context.TenantFeatures.Add(new TenantFeatures { Delivery = true, CallCentre = on, UpdatedAt = DateTime.UtcNow });
        }
        context.SaveChanges();
        return context;
    }

    private static BranchSettings Row(int id, DeliveryTerms terms, bool ordering = true, double[][]? area = null) => new()
    {
        BranchId = id,
        IsActive = true,
        IsOrderingEnabled = ordering,
        IsDeliveryEnabled = true,
        Latitude = terms.Latitude,
        Longitude = terms.Longitude,
        DeliveryRadiusKm = terms.RadiusKm,
        DeliveryFee = terms.Fee,
        DeliveryMinimumOrder = terms.MinimumOrder,
        DeliveryArea = area,
    };

    private static DefaultHttpContext At(int branchId)
    {
        var http = new DefaultHttpContext();
        http.Request.Headers[BranchHeaderExtensions.HeaderName] = branchId.ToString();
        return http;
    }

    private static IHttpClientFactory NoLinks()
    {
        var http = Substitute.For<IHttpClientFactory>();
        http.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient());
        return http;
    }

    private static string Caller => FormattableString.Invariant($"{CallerLat}, {CallerLng}");

    // --- Branch tills in a call-centre business --------------------------------

    [TestMethod]
    public async Task Without_a_call_centre_the_branch_till_offers_the_nearer_branch()
    {
        await using var context = ContextWith(callCentre: false, Row(Downtown, DowntownTerms), Row(Maadi, MaadiTerms));

        var quote = await DeliveryApi.GetTillDeliveryQuoteAsync(At(Downtown), new BranchSettingsQueries(context), NoLinks(), Caller);

        Assert.AreEqual(Maadi, quote.Value!.Alternatives.Single().BranchId);
    }

    [TestMethod]
    public async Task With_a_call_centre_the_branch_till_offers_no_other_branch()
    {
        await using var context = ContextWith(callCentre: true, Row(Downtown, DowntownTerms), Row(Maadi, MaadiTerms));

        var quote = await DeliveryApi.GetTillDeliveryQuoteAsync(At(Downtown), new BranchSettingsQueries(context), NoLinks(), Caller);

        Assert.IsEmpty(quote.Value!.Alternatives, "the calls come through the hotline");
        Assert.IsTrue(quote.Value.InRange, "the till's own answer is unchanged");
        Assert.AreEqual(20m, quote.Value.Fee);
    }

    [TestMethod]
    public async Task The_switch_rides_the_tenant_event_into_the_quote()
    {
        await using var context = ContextWith(callCentre: null, Row(Downtown, DowntownTerms), Row(Maadi, MaadiTerms));
        var queries = new BranchSettingsQueries(context);
        Assert.IsFalse(await queries.IsCallCentreOnAsync(), "a stack that never said has no call centre");

        await new TenantFeaturesChangedIntegrationEventHandler(context, NullLogger<TenantFeaturesChangedIntegrationEventHandler>.Instance)
            .Handle(new TenantFeaturesChangedIntegrationEvent(Delivery: true, CallCentre: true) { CreationDate = DateTime.UtcNow });

        Assert.IsTrue(await queries.IsCallCentreOnAsync());
        var quote = await DeliveryApi.GetTillDeliveryQuoteAsync(At(Downtown), queries, NoLinks(), Caller);
        Assert.IsEmpty(quote.Value!.Alternatives);
    }

    // --- The hotline's question -----------------------------------------------

    [TestMethod]
    public async Task The_hotline_is_told_every_branch_that_reaches_the_caller_nearest_first_paused_ones_flagged()
    {
        await using var context = ContextWith(callCentre: true,
            Row(Downtown, DowntownTerms), Row(Maadi, MaadiTerms, ordering: false), Row(Zamalek, ZamalekTerms));

        var answer = (Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(
            new BranchSettingsQueries(context), NoLinks(), Caller)).Result;

        var resolution = answer.Value!;
        Assert.IsTrue(resolution.Delivers);
        Assert.IsTrue(resolution.LocationRead);
        Assert.AreEqual(CallerLat, resolution.Latitude);
        CollectionAssert.AreEqual(new[] { Maadi, Downtown }, resolution.Branches.Select(b => b.BranchId).ToArray(),
            "Zamalek's 3 km do not reach Maadi; the nearer first");
        Assert.IsTrue(resolution.Branches[0].Paused, "a paused branch still takes a phone order, flagged");
        Assert.IsFalse(resolution.Branches[1].Paused);
        Assert.AreEqual(25m, resolution.Branches[0].Fee);
        Assert.AreEqual(100m, resolution.Branches[0].MinimumOrder);
    }

    [TestMethod]
    public async Task The_hotline_may_ask_with_a_pin_and_is_told_when_a_location_cannot_be_read()
    {
        await using var context = ContextWith(callCentre: true, Row(Downtown, DowntownTerms));
        var queries = new BranchSettingsQueries(context);

        var pinned = (Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(
            queries, NoLinks(), latitude: 30.05, longitude: 31.24)).Result;
        var words = (Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(
            queries, NoLinks(), "Maadi road 9")).Result;
        var bad = await DeliveryApi.ResolveDeliveryBranchForStaffAsync(queries, NoLinks(), latitude: 95, longitude: 31);

        Assert.AreEqual(Downtown, pinned.Value!.Branches.Single().BranchId);
        Assert.IsFalse(words.Value!.LocationRead);
        Assert.IsEmpty(words.Value.Branches);
        Assert.IsInstanceOfType<ProblemHttpResult>(bad.Result);
    }

    [TestMethod]
    public async Task The_hotline_hears_when_nobody_delivers()
    {
        await using var context = ContextWith(callCentre: true);

        var answer = (Ok<StaffDeliveryResolution>)(await DeliveryApi.ResolveDeliveryBranchForStaffAsync(
            new BranchSettingsQueries(context), NoLinks(), Caller)).Result;

        Assert.IsFalse(answer.Value!.Delivers);
        Assert.IsEmpty(answer.Value.Branches);
    }

    // --- A drawn area on the quotes -------------------------------------------

    [TestMethod]
    public async Task The_quotes_say_when_the_branch_delivers_to_a_drawn_area()
    {
        await using var drawn = ContextWith(callCentre: false, Row(Downtown, DowntownTerms with { RadiusKm = 0 }, area: AroundDowntown));
        await using var circle = ContextWith(callCentre: false, Row(Downtown, DowntownTerms));

        var till = await DeliveryApi.GetTillDeliveryQuoteAsync(At(Downtown), new BranchSettingsQueries(drawn), NoLinks());
        var customer = (Ok<DeliveryQuote>)(await DeliveryApi.GetDeliveryQuoteAsync(30.05, 31.24, At(Downtown), new BranchSettingsQueries(drawn))).Result;
        var round = await DeliveryApi.GetTillDeliveryQuoteAsync(At(Downtown), new BranchSettingsQueries(circle), NoLinks());

        Assert.IsTrue(till.Value!.HasArea);
        Assert.AreEqual(0m, till.Value.RadiusKm, "the radius the till used to show");
        Assert.IsTrue(customer.Value!.HasArea);
        Assert.IsFalse(round.Value!.HasArea);
    }

    // --- Every branch's earlier deliveries, for the hotline ----------------------

    [TestMethod]
    public void A_star_in_the_claim_is_what_lets_the_hotline_look_across_branches()
    {
        var hotline = new ClaimsPrincipal(new ClaimsIdentity([new Claim("role", "Cashier"), new Claim("branches", "*")], "test"));
        var cashier = new ClaimsPrincipal(new ClaimsIdentity([new Claim("role", "Cashier"), new Claim("branches", "1")], "test"));

        Assert.IsTrue(hotline.HoldsAllBranches());
        Assert.IsFalse(cashier.HoldsAllBranches());
    }
}
