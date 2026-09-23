using System.Net;
using System.Net.Http.Json;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

public record KitchenStationView(int Id, LocalizedView Name, List<int> CategoryIds, bool ShowsOnScreen, bool PrintsTickets,
    string? PrinterHost, int PrinterPort, bool IsDefault, int DisplayOrder);
public record KitchenTicketView(int JobId, int StationId, string? PrinterHost, int PrinterPort, bool IsTest, bool IsReprint,
    int? OrderNumber, DateTime? ClaimedAt, int Attempts, string? LastError);

/// <summary>
/// A branch's kitchen: its stations, set up by the back office, and the
/// queue its printers are fed from, which the devices in the shop share.
/// Each scenario works in a branch of its own, so stations never collide.
/// </summary>
[TestClass]
public sealed class KitchenScenarios
{
    private const string Kitchen = "/api/kitchen";
    private const string Version = "api-version=1.0";

    private static Caller BackOffice(int branch) => Suite.Ordering.As(Persona.Admin(branch), branch);
    private static Caller Till(int branch) => Suite.Ordering.As(Persona.Cashier(branch), branch);

    private static object Station(string name, int[] categories, bool screen, bool printer, string? host = null) => new
    {
        name = new { en = name, ar = name },
        categoryIds = categories,
        showsOnScreen = screen,
        printsTickets = printer,
        printerHost = host,
    };

    [TestMethod]
    public async Task A_branch_starts_with_one_kitchen_screen_that_makes_everything()
    {
        var stations = await Till(701).GetAsync<List<KitchenStationView>>($"{Kitchen}/stations?{Version}");

        var only = stations.Single();
        Assert.IsTrue(only.IsDefault);
        Assert.IsTrue(only.ShowsOnScreen);
        Assert.IsFalse(only.PrintsTickets);

        var again = await Till(701).GetAsync<List<KitchenStationView>>($"{Kitchen}/stations?{Version}");
        Assert.AreEqual(only.Id, again.Single().Id, "the default is kept, not made afresh on every read");
    }

    [TestMethod]
    public async Task The_back_office_splits_the_kitchen_by_category()
    {
        const int branch = 702;
        var bar = await BackOffice(branch).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Bar", [20, 21], screen: true, printer: false));
        var shisha = await BackOffice(branch).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Shisha", [30], screen: false, printer: true, host: "192.168.1.60"));

        var stations = await Till(branch).GetAsync<List<KitchenStationView>>($"{Kitchen}/stations?{Version}");
        Assert.HasCount(3, stations, "the default kitchen, the bar and the shisha printer");
        CollectionAssert.AreEqual(new[] { 20, 21 }, stations.Single(s => s.Id == bar.Id).CategoryIds);
        Assert.AreEqual(9100, stations.Single(s => s.Id == shisha.Id).PrinterPort, "a printer's port defaults to the raw printing one");

        // A category is made at one station; moving it means taking it off the other first
        var (status, detail) = await BackOffice(branch).RefusedAsync(HttpMethod.Post, $"{Kitchen}/stations?{Version}",
            Station("Juice", [21], screen: true, printer: false));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("21", detail, StringComparison.Ordinal);
    }

    [TestMethod]
    public async Task A_station_has_to_be_heard_somehow()
    {
        const int branch = 703;
        var (silent, _) = await BackOffice(branch).RefusedAsync(HttpMethod.Post, $"{Kitchen}/stations?{Version}",
            Station("Nowhere", [], screen: false, printer: false));
        Assert.AreEqual(HttpStatusCode.BadRequest, silent);

        var (noPrinter, _) = await BackOffice(branch).RefusedAsync(HttpMethod.Post, $"{Kitchen}/stations?{Version}",
            Station("Shisha", [], screen: false, printer: true));
        Assert.AreEqual(HttpStatusCode.BadRequest, noPrinter, "a station that prints needs its printer's address");
    }

    [TestMethod]
    public async Task The_default_station_stays_and_the_others_can_go()
    {
        const int branch = 704;
        var stations = await Till(branch).GetAsync<List<KitchenStationView>>($"{Kitchen}/stations?{Version}");
        var (kept, _) = await BackOffice(branch).RefusedAsync(HttpMethod.Delete, $"{Kitchen}/stations/{stations.Single().Id}?{Version}");
        Assert.AreEqual(HttpStatusCode.BadRequest, kept);

        var bar = await BackOffice(branch).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Bar", [20], screen: true, printer: false));
        using var removed = await BackOffice(branch).RawAsync(HttpMethod.Delete, $"{Kitchen}/stations/{bar.Id}?{Version}");
        Assert.AreEqual(HttpStatusCode.NoContent, removed.StatusCode);
    }

    [TestMethod]
    public async Task Another_branch_cannot_touch_a_station()
    {
        var bar = await BackOffice(705).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Bar", [20], screen: true, printer: false));

        var (status, _) = await BackOffice(706).RefusedAsync(HttpMethod.Put, $"{Kitchen}/stations/{bar.Id}?{Version}",
            Station("Mine now", [20], screen: true, printer: false));
        Assert.AreEqual(HttpStatusCode.NotFound, status);
    }

    [TestMethod]
    public async Task Only_the_back_office_sets_up_stations()
    {
        var (status, _) = await Till(707).RefusedAsync(HttpMethod.Post, $"{Kitchen}/stations?{Version}",
            Station("Bar", [20], screen: true, printer: false));
        Assert.AreEqual(HttpStatusCode.Forbidden, status);

        var customer = Suite.Ordering.As(Persona.Customer(), 707);
        foreach (var path in new[] { $"{Kitchen}/stations?{Version}", $"{Kitchen}/print-jobs?{Version}" })
        {
            var (refused, _) = await customer.RefusedAsync(HttpMethod.Get, path);
            Assert.AreEqual(HttpStatusCode.Forbidden, refused, path);
        }
    }

    [TestMethod]
    public async Task Two_devices_reach_for_one_ticket_and_one_prints_it()
    {
        const int branch = 708;
        var shisha = await BackOffice(branch).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Shisha", [30], screen: false, printer: true, host: "192.168.1.60"));
        using (var test = await BackOffice(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/stations/{shisha.Id}/test-print?{Version}"))
        {
            Assert.AreEqual(HttpStatusCode.NoContent, test.StatusCode);
        }

        var ticket = (await Till(branch).GetAsync<List<KitchenTicketView>>($"{Kitchen}/print-jobs?{Version}")).Single();
        Assert.IsTrue(ticket.IsTest);
        Assert.AreEqual("192.168.1.60", ticket.PrinterHost);

        // The till and the kitchen tablet both heard about it
        var claims = await Task.WhenAll(
            Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/claim?{Version}", new { deviceId = "till" }),
            Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/claim?{Version}", new { deviceId = "tablet" }));
        var statuses = claims.Select(c => c.StatusCode).ToList();
        foreach (var claim in claims) claim.Dispose();
        Assert.AreEqual(1, statuses.Count(s => s == HttpStatusCode.NoContent), string.Join(", ", statuses));
        Assert.AreEqual(1, statuses.Count(s => s == HttpStatusCode.Conflict), string.Join(", ", statuses));

        using (var printed = await Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/printed?{Version}"))
        {
            Assert.AreEqual(HttpStatusCode.NoContent, printed.StatusCode);
        }

        var left = await Till(branch).GetAsync<List<KitchenTicketView>>($"{Kitchen}/print-jobs?{Version}");
        Assert.IsEmpty(left, "printed paper leaves the queue");
    }

    [TestMethod]
    public async Task A_refused_ticket_waits_for_the_next_try_with_its_reason()
    {
        const int branch = 709;
        var shisha = await BackOffice(branch).PostAsync<KitchenStationView>($"{Kitchen}/stations?{Version}",
            Station("Shisha", [30], screen: false, printer: true, host: "192.168.1.61"));
        using (await BackOffice(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/stations/{shisha.Id}/test-print?{Version}")) { }
        var ticket = (await Till(branch).GetAsync<List<KitchenTicketView>>($"{Kitchen}/print-jobs?{Version}")).Single();

        using (await Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/claim?{Version}", new { deviceId = "till" })) { }
        using (var failed = await Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/failed?{Version}", new { error = "Connection refused" }))
        {
            Assert.AreEqual(HttpStatusCode.NoContent, failed.StatusCode);
        }

        var waiting = (await Till(branch).GetAsync<List<KitchenTicketView>>($"{Kitchen}/print-jobs?{Version}")).Single();
        Assert.AreEqual(1, waiting.Attempts);
        Assert.AreEqual("Connection refused", waiting.LastError, "what the till's warning shows");
        Assert.IsNull(waiting.ClaimedAt, "any device may try it again");

        using var again = await Till(branch).RawAsync(HttpMethod.Post, $"{Kitchen}/print-jobs/{ticket.JobId}/claim?{Version}", new { deviceId = "tablet" });
        Assert.AreEqual(HttpStatusCode.NoContent, again.StatusCode);
    }

    [TestMethod]
    public async Task A_station_that_only_shows_has_nothing_to_print()
    {
        const int branch = 710;
        var stations = await Till(branch).GetAsync<List<KitchenStationView>>($"{Kitchen}/stations?{Version}");

        var (status, _) = await BackOffice(branch).RefusedAsync(HttpMethod.Post, $"{Kitchen}/stations/{stations.Single().Id}/test-print?{Version}");
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
    }
}
