using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Tenant.API.Apis;
using Ninja.Tenant.API.Infrastructure;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Ninja.IntegrationEventLogEF;
using Ninja.IntegrationEventLogEF.Services;
using Ninja.ServiceDefaults;

namespace Ninja.Tenant.UnitTests;

/// <summary>
/// A delivery area drawn on the map: held to being a ring round the branch
/// that does not cross itself, enough for a branch to deliver without a
/// radius, and sent to Ordering on the branch's settings event.
/// </summary>
[TestClass]
public sealed class DeliveryAreaTests
{
    // Downtown Cairo, and a square of streets round it, about 2 km a side
    private const double Lat = 30.0444, Lng = 31.2357;
    private static readonly double[][] Square = [[30.035, 31.225], [30.055, 31.225], [30.055, 31.245], [30.035, 31.245]];

    // --- The rules ------------------------------------------------------------

    [TestMethod]
    public void A_ring_round_the_branch_is_kept_as_drawn()
    {
        var (area, problem) = DeliveryAreaRules.Check(Square, Lat, Lng);

        Assert.IsNull(problem);
        Assert.HasCount(4, area!);
        CollectionAssert.AreEqual(Square[1], area![1]);
    }

    [TestMethod]
    public void A_ring_drawn_closed_loses_its_repeated_point()
    {
        var (area, problem) = DeliveryAreaRules.Check([.. Square, Square[0]], Lat, Lng);

        Assert.IsNull(problem);
        Assert.HasCount(4, area!);
    }

    [TestMethod]
    public void Fewer_than_three_points_are_refused()
    {
        var (_, two) = DeliveryAreaRules.Check([Square[0], Square[1]], Lat, Lng);
        // Three points, but the third closes the ring back onto the first
        var (_, closedTwo) = DeliveryAreaRules.Check([Square[0], Square[1], Square[0]], Lat, Lng);

        Assert.Contains("at least 3 points", two!);
        Assert.Contains("at least 3 points", closedTwo!);
    }

    [TestMethod]
    public void More_than_two_hundred_points_are_refused()
    {
        var circle = Enumerable.Range(0, 201)
            .Select(i => new[] { Lat + (0.01 * Math.Cos(i * 2 * Math.PI / 201)), Lng + (0.01 * Math.Sin(i * 2 * Math.PI / 201)) })
            .ToArray();

        var (_, problem) = DeliveryAreaRules.Check(circle, Lat, Lng);

        Assert.Contains("up to 200 points", problem!);
        Assert.IsNull(DeliveryAreaRules.Check(circle[..200], Lat, Lng).Problem);
    }

    [TestMethod]
    public void A_ring_that_crosses_itself_is_refused()
    {
        // A bow tie: the second and fourth corners swapped
        double[][] bowTie = [Square[0], Square[2], Square[1], Square[3]];

        var (_, problem) = DeliveryAreaRules.Check(bowTie, Lat, Lng);

        Assert.Contains("cross", problem!);
    }

    [TestMethod]
    public void A_ring_that_folds_back_on_itself_is_refused()
    {
        // The last edge runs back over the one before it
        double[][] spike = [Square[0], Square[1], Square[2], [30.055, 31.235]];

        var (_, problem) = DeliveryAreaRules.Check(spike, Lat, Lng);

        Assert.Contains("cross", problem!);
    }

    [TestMethod]
    public void A_concave_ring_is_fine()
    {
        double[][] u = [[30.035, 31.225], [30.055, 31.225], [30.055, 31.230], [30.040, 31.230], [30.040, 31.240], [30.055, 31.240], [30.055, 31.245], [30.035, 31.245]];

        Assert.IsNull(DeliveryAreaRules.Check(u, Lat, Lng).Problem);
    }

    [TestMethod]
    public void Points_on_one_line_are_refused()
    {
        var (_, problem) = DeliveryAreaRules.Check([[30.04, 31.23], [30.05, 31.23], [30.06, 31.23]], Lat, Lng);

        Assert.Contains("one line", problem!);
    }

    [TestMethod]
    public void An_area_far_from_the_branch_is_refused()
    {
        // Alexandria, some 180 km away
        double[][] alexandria = [[31.19, 29.90], [31.22, 29.90], [31.22, 29.95]];

        var (_, problem) = DeliveryAreaRules.Check(alexandria, Lat, Lng);

        Assert.Contains("within 50 km", problem!);
    }

    [TestMethod]
    public void An_area_needs_the_branch_on_the_map_and_points_that_are_points()
    {
        Assert.Contains("location", DeliveryAreaRules.Check(Square, null, null).Problem!);
        Assert.Contains("latitude and a longitude", DeliveryAreaRules.Check([[30.04], Square[1], Square[2]], Lat, Lng).Problem!);
        Assert.Contains("latitude and a longitude", DeliveryAreaRules.Check([[95, 31.2], Square[1], Square[2]], Lat, Lng).Problem!);
    }

    [TestMethod]
    public void A_branch_on_the_map_with_an_area_and_no_radius_can_deliver()
    {
        var branch = new API.Model.Branch { Latitude = Lat, Longitude = Lng };
        Assert.IsFalse(branch.CanDeliver);

        branch.DeliveryArea = Square;

        Assert.IsTrue(branch.CanDeliver);
    }

    // --- Through the branch's edit, to the event ----------------------------------

    private static (ServiceProvider Services, RecordingBus Bus) AStack()
    {
        var bus = new RecordingBus();
        var name = $"area-{Guid.NewGuid()}";
        var services = new ServiceCollection()
            .AddDbContext<TenantContext>(o => o.UseInMemoryDatabase(name).ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)))
            .AddSingleton<IEventBus>(bus)
            .AddSingleton<IIntegrationEventLogService, NoLog>()
            .AddLogging()
            .AddScoped<TenantEvents>()
            .AddScoped<BranchSettingsService>()
            .BuildServiceProvider();

        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TenantContext>();
        context.Tenants.Add(new API.Model.Tenant { Name = new LocalizedText("Chillax", null) });
        context.Branches.Add(new API.Model.Branch { Name = new LocalizedText("Downtown", null), Latitude = Lat, Longitude = Lng });
        context.SaveChanges();

        return (services, bus);
    }

    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());

    private static async Task<IResult> UpdateAsync(ServiceProvider services, double[][]? area, bool? delivery = null, decimal? radiusKm = null)
    {
        using var scope = services.CreateScope();
        var result = await BranchApi.UpdateBranch(
            scope.ServiceProvider.GetRequiredService<TenantContext>(),
            scope.ServiceProvider.GetRequiredService<BranchSettingsService>(),
            1,
            Egypt,
            new NoHttp(),
            new UpdateBranchRequest(new LocalizedText("Downtown", null), null, null, true, 0,
                IsDeliveryEnabled: delivery, DeliveryRadiusKm: radiusKm, DeliveryArea: area),
            CancellationToken.None);
        return (IResult)result.Result;
    }

    private static string DetailOf(IResult result)
    {
        Assert.IsInstanceOfType<BadRequest<ProblemDetails>>(result);
        return ((BadRequest<ProblemDetails>)result).Value!.Detail!;
    }

    [TestMethod]
    public async Task A_drawn_area_alone_lets_delivery_on_and_rides_the_event()
    {
        var (services, bus) = AStack();

        var saved = await UpdateAsync(services, Square, delivery: true);

        Assert.IsInstanceOfType<Ok<BranchResponse>>(saved);
        var response = ((Ok<BranchResponse>)saved).Value!;
        Assert.IsTrue(response.IsDeliveryEnabled);
        Assert.HasCount(4, response.DeliveryArea!);

        var said = bus.Published.OfType<BranchSettingsChangedIntegrationEvent>().Single();
        Assert.IsTrue(said.IsDeliveryEnabled);
        Assert.HasCount(4, said.DeliveryArea!);
        CollectionAssert.AreEqual(Square[2], said.DeliveryArea![2]);
    }

    [TestMethod]
    public async Task Leaving_the_area_out_keeps_it_and_an_empty_one_takes_it_away()
    {
        var (services, bus) = AStack();
        await UpdateAsync(services, Square, radiusKm: 5);

        await UpdateAsync(services, null);
        Assert.HasCount(4, bus.Published.OfType<BranchSettingsChangedIntegrationEvent>().Last().DeliveryArea!);

        await UpdateAsync(services, []);
        Assert.IsNull(bus.Published.OfType<BranchSettingsChangedIntegrationEvent>().Last().DeliveryArea);
    }

    [TestMethod]
    public async Task A_bad_area_is_refused_and_nothing_is_said()
    {
        var (services, bus) = AStack();

        var crossed = await UpdateAsync(services, [Square[0], Square[2], Square[1], Square[3]]);

        Assert.Contains("cross", DetailOf(crossed));
        Assert.IsEmpty(bus.Published.OfType<BranchSettingsChangedIntegrationEvent>());
    }

    [TestMethod]
    public async Task Taking_the_only_area_from_a_delivering_branch_is_refused()
    {
        var (services, _) = AStack();
        await UpdateAsync(services, Square, delivery: true);

        var cleared = await UpdateAsync(services, []);

        Assert.Contains("Turn delivery off first", DetailOf(cleared));
    }

    /// <summary>No location is pasted here, so nothing is fetched.</summary>
    private sealed class NoHttp : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }

    /// <summary>The outbox, as far as these tests go: nothing kept, everything sent straight away.</summary>
    private sealed class NoLog : IIntegrationEventLogService
    {
        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveEventLogsPendingToPublishAsync(Guid transactionId) => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());
        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveStuckEventLogsAsync(DateTime createdBefore, int maxAttempts) => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());
        public Task SaveEventAsync(IntegrationEvent @event, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction) => Task.CompletedTask;
        public Task MarkEventAsPublishedAsync(Guid eventId) => Task.CompletedTask;
        public Task MarkEventAsInProgressAsync(Guid eventId) => Task.CompletedTask;
        public Task MarkEventAsFailedAsync(Guid eventId) => Task.CompletedTask;
    }

    private sealed class RecordingBus : IEventBus
    {
        public List<IntegrationEvent> Published { get; } = [];

        public Task PublishAsync(IntegrationEvent @event)
        {
            Published.Add(@event);
            return Task.CompletedTask;
        }
    }
}
