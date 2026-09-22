using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Notification.API.Infrastructure;
using Ninja.Notification.API.Model;
using Ninja.Testing;

namespace Ninja.Notification.FunctionalTests;

/// <summary>The service, once for the suite, with the places a request can come from planted in its projection.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;
    public const int Room = 101;
    public const int TimedRoomWithRates = 102;
    public const int PlainTable = 103;

    public static ServiceUnderTest<Program> Notifications { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Notifications = new ServiceUnderTest<Program>("notificationdb");
        _ = Notifications.CreateClient();

        // Spaces' events fill this projection on a running stack; here it is planted, so the
        // scenarios are about what a place may be asked for, not about how it got there
        using var scope = Notifications.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NotificationContext>();
        db.Places.AddRange(
            new Place { PlaceId = Room, Kind = "Room", Name = new("Sega room"), BranchId = Branch, IsTimed = true, HasOptions = false, IsActive = true },
            new Place { PlaceId = TimedRoomWithRates, Kind = "Room", Name = new("PS5 room"), BranchId = Branch, IsTimed = true, HasOptions = true, IsActive = true },
            new Place { PlaceId = PlainTable, Kind = "Table", Name = new("Table 4"), BranchId = Branch, IsTimed = false, HasOptions = false, IsActive = true });
        await db.SaveChangesAsync();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Notifications.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>
/// What the apps read off the wire; named here so a change in the API's
/// shape fails a test. The service has no string-enum converter, so a kind
/// and a status travel as their numbers — which is the contract the apps
/// are written against.
/// </summary>
public record ServiceRequestView(int Id, string UserName, ServiceRequestType RequestType, ServiceRequestStatus Status, int? PlaceId, string? PlaceKind, string? OptionCode, string? AcknowledgedBy);

/// <summary>
/// Calling the waiter: who may ask, what a place can be asked for, and how
/// the till answers — picked up, then done.
/// </summary>
[TestClass]
public sealed class ServiceRequestScenarios
{
    private const string Version = "?api-version=1.0";

    private static Caller Guest(string? guestId = null)
    {
        var caller = Suite.Notifications.AsAnonymous();
        caller.Http.DefaultRequestHeaders.Add("X-Guest-Id", guestId ?? Guid.NewGuid().ToString("N"));
        caller.Http.DefaultRequestHeaders.Add("X-Branch-Id", Suite.Branch.ToString());
        return caller;
    }

    private static object Request(int placeId, ServiceRequestType type = ServiceRequestType.CallWaiter, int? sessionId = null, string? optionCode = null)
        => new { requestType = (int)type, placeId, sessionId, optionCode };

    [TestMethod]
    public async Task A_guest_at_a_table_calls_the_waiter_and_the_till_picks_it_up_and_finishes_it()
    {
        var guest = Guest();
        var till = Suite.Notifications.As(Persona.Cashier(Suite.Branch), Suite.Branch);

        var raised = await guest.PostAsync<ServiceRequestView>($"/api/notifications/service-requests{Version}", Request(Suite.PlainTable), HttpStatusCode.Created);
        Assert.AreEqual(ServiceRequestType.CallWaiter, raised.RequestType);
        Assert.AreEqual(ServiceRequestStatus.Pending, raised.Status);
        Assert.AreEqual(Suite.PlainTable, raised.PlaceId);
        Assert.AreEqual("Guest", raised.UserName, "a guest at a table has no name but is still served");

        var mine = await guest.GetAsync<List<ServiceRequestView>>($"/api/notifications/service-requests/mine{Version}");
        Assert.AreEqual(raised.Id, mine.Single().Id);

        var waiting = await till.GetAsync<List<ServiceRequestView>>($"/api/notifications/service-requests/pending{Version}");
        Assert.IsTrue(waiting.Any(r => r.Id == raised.Id), "the counter sees it");

        var picked = await till.PutAsync<ServiceRequestView>($"/api/notifications/service-requests/{raised.Id}/acknowledge{Version}");
        Assert.AreEqual(ServiceRequestStatus.Acknowledged, picked.Status);
        Assert.IsNotNull(picked.AcknowledgedBy, "the customer is told who is on the way");

        var done = await till.PutAsync<ServiceRequestView>($"/api/notifications/service-requests/{raised.Id}/complete{Version}");
        Assert.AreEqual(ServiceRequestStatus.Completed, done.Status);
        Assert.IsFalse((await till.GetAsync<List<ServiceRequestView>>($"/api/notifications/service-requests/pending{Version}")).Any(r => r.Id == raised.Id));
    }

    [TestMethod]
    public async Task The_same_request_twice_is_one_request()
    {
        var guest = Guest();
        await guest.PostAsync<ServiceRequestView>($"/api/notifications/service-requests{Version}", Request(Suite.PlainTable, ServiceRequestType.ReceiptToPay), HttpStatusCode.Created);

        var (status, detail) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(Suite.PlainTable, ServiceRequestType.ReceiptToPay));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("already have this request waiting", detail);
    }

    [TestMethod]
    public async Task What_a_place_can_be_asked_for_follows_from_what_it_is()
    {
        var guest = Guest();

        // A controller is a room's to give
        await guest.PostAsync<ServiceRequestView>($"/api/notifications/service-requests{Version}", Request(Suite.Room, ServiceRequestType.ControllerChange), HttpStatusCode.Created);
        var (atATable, detail) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(Suite.PlainTable, ServiceRequestType.ControllerChange));
        Assert.AreEqual(HttpStatusCode.BadRequest, atATable);
        Assert.Contains("cannot take that kind of request", detail);

        // A rate change needs a place with rates, a clock running, and the option wanted
        var (noClock, _) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(Suite.TimedRoomWithRates, ServiceRequestType.ChangeOption, optionCode: "multi"));
        Assert.AreEqual(HttpStatusCode.BadRequest, noClock, "no stay, nothing to change");

        var (noOption, why) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(Suite.TimedRoomWithRates, ServiceRequestType.ChangeOption, sessionId: 7));
        Assert.AreEqual(HttpStatusCode.BadRequest, noOption);
        Assert.Contains("names the option wanted", why);

        var changed = await guest.PostAsync<ServiceRequestView>($"/api/notifications/service-requests{Version}", Request(Suite.TimedRoomWithRates, ServiceRequestType.ChangeOption, sessionId: 7, optionCode: "multi"), HttpStatusCode.Created);
        Assert.AreEqual("multi", changed.OptionCode);
    }

    [TestMethod]
    public async Task A_request_names_the_place_it_comes_from_and_nobody_raises_one_from_nowhere()
    {
        var guest = Guest();

        var (noPlace, detail) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(0));
        Assert.AreEqual(HttpStatusCode.BadRequest, noPlace);
        Assert.Contains("names the place", detail);

        var (unknownPlace, _) = await guest.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(9999));
        Assert.AreEqual(HttpStatusCode.BadRequest, unknownPlace, "a place nobody has heard of takes nothing");

        // Nobody at all: no signed-in customer and no guest id the browser keeps
        var nobody = Suite.Notifications.AsAnonymous();
        nobody.Http.DefaultRequestHeaders.Add("X-Branch-Id", Suite.Branch.ToString());
        var (anonymous, _) = await nobody.RefusedAsync(HttpMethod.Post, $"/api/notifications/service-requests{Version}", Request(Suite.PlainTable));
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);
    }

    [TestMethod]
    public async Task A_request_is_the_guests_to_cancel_and_nobody_elses()
    {
        var mine = Guest();
        var someone = Guest();
        var raised = await mine.PostAsync<ServiceRequestView>($"/api/notifications/service-requests{Version}", Request(Suite.Room), HttpStatusCode.Created);

        var (theirs, _) = await someone.RefusedAsync(HttpMethod.Delete, $"/api/notifications/service-requests/{raised.Id}{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, theirs, "another guest's request is not theirs to cancel");

        var (ok, _) = await mine.RefusedAsync(HttpMethod.Delete, $"/api/notifications/service-requests/{raised.Id}{Version}");
        Assert.AreEqual(HttpStatusCode.OK, ok);
        Assert.IsEmpty(await mine.GetAsync<List<ServiceRequestView>>($"/api/notifications/service-requests/mine{Version}"));
    }

    [TestMethod]
    public async Task The_counter_is_the_tills_to_read()
    {
        var customer = Suite.Notifications.As(Persona.Customer(), Suite.Branch);

        foreach (var (method, path) in new[]
        {
            (HttpMethod.Get, $"/api/notifications/service-requests/pending{Version}"),
            (HttpMethod.Put, $"/api/notifications/service-requests/1/acknowledge{Version}"),
            (HttpMethod.Put, $"/api/notifications/service-requests/1/complete{Version}"),
        })
        {
            var (status, _) = await customer.RefusedAsync(method, path);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path}");
        }
    }
}
