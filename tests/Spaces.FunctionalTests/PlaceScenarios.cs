using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Spaces.Infrastructure;
using Ninja.Spaces.Infrastructure.Projections;
using Ninja.Testing;

namespace Ninja.Spaces.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static ServiceUnderTest<Program> Spaces { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Spaces = new ServiceUnderTest<Program>("spacesdb");
        _ = Spaces.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Spaces.DisposeAsync();
        await SharedServices.StopAsync();
    }

    /// <summary>
    /// What the café's plan allows, as Branch.API's event would have left
    /// it: the projection Spaces keeps and reads, written here directly so a
    /// scenario is about the rule and not about the broker.
    /// </summary>
    public static async Task ModulesAsync(bool reservations, bool timeBilling)
    {
        using var scope = Spaces.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SpacesContext>();
        var row = await db.TenantFeatures.FindAsync(TenantFeatures.SingletonId);
        if (row is null)
        {
            db.TenantFeatures.Add(new TenantFeatures { Reservations = reservations, TimeBilling = timeBilling, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            row.Reservations = reservations;
            row.TimeBilling = timeBilling;
            row.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record PlaceView(int Id, int Kind, LocalizedView Name, int BranchId, bool IsActive, bool IsTimed, bool HasOptions, bool Reservable, bool CanReserve, TariffView? Tariff);
public record LocalizedView(string En, string? Ar);
public record TariffView(List<RateOptionView> Options, int RoundingMinutes);
public record RateOptionView(string Code, LocalizedView Name, decimal HourlyRate);

/// <summary>
/// The places a café has: plain tables every café keeps, and the rates and
/// bookings that are a module's — refused while the module is off, whatever
/// the request says.
/// </summary>
[TestClass]
public sealed class PlaceScenarios
{
    private const string Places = "/api/places?api-version=1.0";
    private static string Place(int id, string tail = "") => $"/api/places/{id}{tail}?api-version=1.0";

    private static Caller Admin => Suite.Spaces.As(Persona.Admin(Suite.Branch), Suite.Branch);

    private static object NewPlace(string name, int kind = 2, object? tariff = null, bool? reservable = null)
        => new { kind, name = new { en = name, ar = name }, tariff, reservable };

    private static object Tariff(decimal rate = 50m, params string[] options)
        => new
        {
            options = (options.Length == 0 ? ["single"] : options).Select(code => new { code, name = new { en = code, ar = code }, hourlyRate = rate }).ToArray(),
            roundingMinutes = 15,
        };

    [TestInitialize]
    public Task EveryModuleOn() => Suite.ModulesAsync(reservations: true, timeBilling: true);

    [TestMethod]
    public async Task Every_cafe_has_plain_tables_and_the_apps_can_list_them()
    {
        var id = await Admin.PostAsync<int>(Places, NewPlace("Table 1"), HttpStatusCode.Created);

        var place = await Admin.GetAsync<PlaceView>(Place(id));
        Assert.AreEqual("Table 1", place.Name.En);
        Assert.IsFalse(place.IsTimed, "a plain table has no clock");
        Assert.IsNull(place.Tariff);
        Assert.IsTrue(place.IsActive);

        var listed = await Suite.Spaces.As(Persona.Customer(), Suite.Branch).GetAsync<List<PlaceView>>(Places);
        Assert.IsTrue(listed.Any(p => p.Id == id), "the customer app lists the places to scan and book");
    }

    [TestMethod]
    public async Task A_room_with_rates_runs_a_clock_and_takes_bookings_by_default()
    {
        var id = await Admin.PostAsync<int>(Places, NewPlace("PS5 room", kind: 1, tariff: Tariff(80m, "single", "multi")), HttpStatusCode.Created);

        var place = await Admin.GetAsync<PlaceView>(Place(id));
        Assert.IsTrue(place.IsTimed);
        Assert.IsTrue(place.HasOptions, "two rates are a choice at the counter");
        Assert.IsTrue(place.Reservable, "a place with a clock takes bookings unless the owner says otherwise");
        Assert.AreEqual(2, place.Tariff!.Options.Count);
        Assert.AreEqual(80m, place.Tariff.Options[0].HourlyRate);
    }

    [TestMethod]
    public async Task With_the_clock_off_a_place_cannot_be_given_a_rate()
    {
        await Suite.ModulesAsync(reservations: true, timeBilling: false);

        var (created, detail) = await Admin.RefusedAsync(HttpMethod.Post, Places, NewPlace("Room", kind: 1, tariff: Tariff()));
        Assert.AreEqual(HttpStatusCode.BadRequest, created);
        Assert.Contains("Time billing is off", detail);

        // A plain table is still a café's to add, and a rate cannot be put on it afterwards either
        var id = await Admin.PostAsync<int>(Places, NewPlace("Table 2"), HttpStatusCode.Created);
        var (tariff, why) = await Admin.RefusedAsync(HttpMethod.Put, Place(id, "/tariff"), new { tariff = Tariff() });
        Assert.AreEqual(HttpStatusCode.BadRequest, tariff);
        Assert.Contains("Time billing is off", why);

        // Taking a rate off is always allowed: a café that gave the module up still edits its places
        await Suite.ModulesAsync(reservations: true, timeBilling: true);
        var timed = await Admin.PostAsync<int>(Places, NewPlace("Room 2", kind: 1, tariff: Tariff()), HttpStatusCode.Created);
        await Suite.ModulesAsync(reservations: true, timeBilling: false);
        var (removed, _) = await Admin.RefusedAsync(HttpMethod.Put, Place(timed, "/tariff"), new { tariff = (object?)null });
        Assert.AreEqual(HttpStatusCode.OK, removed);
        Assert.IsFalse((await Admin.GetAsync<PlaceView>(Place(timed))).IsTimed);
    }

    [TestMethod]
    public async Task With_bookings_off_a_place_cannot_be_opened_to_them()
    {
        await Suite.ModulesAsync(reservations: false, timeBilling: true);

        var (created, detail) = await Admin.RefusedAsync(HttpMethod.Post, Places, NewPlace("Table 3", reservable: true));
        Assert.AreEqual(HttpStatusCode.BadRequest, created);
        Assert.Contains("Reservations are off", detail);

        // A place with a clock is still added; it just is not open to bookings
        var id = await Admin.PostAsync<int>(Places, NewPlace("Room 3", kind: 1, tariff: Tariff()), HttpStatusCode.Created);
        var place = await Admin.GetAsync<PlaceView>(Place(id));
        Assert.IsTrue(place.IsTimed);
        Assert.IsFalse(place.Reservable, "with the module off a new place is not open to bookings");

        var (opened, why) = await Admin.RefusedAsync(HttpMethod.Put, Place(id, "/reservable"), new { reservable = true });
        Assert.AreEqual(HttpStatusCode.BadRequest, opened);
        Assert.Contains("Reservations are off", why);

        // Closing one is always allowed
        var (closed, _) = await Admin.RefusedAsync(HttpMethod.Put, Place(id, "/reservable"), new { reservable = false });
        Assert.AreEqual(HttpStatusCode.OK, closed);
    }

    [TestMethod]
    public async Task A_place_is_renamed_taken_out_of_service_and_retired()
    {
        var id = await Admin.PostAsync<int>(Places, NewPlace("Table 4"), HttpStatusCode.Created);

        var (renamed, _) = await Admin.RefusedAsync(HttpMethod.Put, Place(id), new { name = new { en = "Corner table", ar = "ترابيزة الركن" } });
        Assert.AreEqual(HttpStatusCode.OK, renamed);
        Assert.AreEqual("Corner table", (await Admin.GetAsync<PlaceView>(Place(id))).Name.En);

        var (retired, _) = await Admin.RefusedAsync(HttpMethod.Put, Place(id, "/active"), new { isActive = false });
        Assert.AreEqual(HttpStatusCode.OK, retired);
        Assert.IsFalse((await Admin.GetAsync<PlaceView>(Place(id))).IsActive);

        var (missing, _) = await Admin.RefusedAsync(HttpMethod.Put, Place(999999), new { name = new { en = "Nowhere" } });
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task The_floor_is_the_back_offices_to_change_and_everyones_to_read()
    {
        var id = await Admin.PostAsync<int>(Places, NewPlace("Table 5"), HttpStatusCode.Created);

        var customer = Suite.Spaces.As(Persona.Customer(), Suite.Branch);
        await customer.GetAsync<PlaceView>(Place(id));

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Post, Places, NewPlace("Not mine")),
            (HttpMethod.Put, Place(id), new { name = new { en = "Renamed" } }),
            (HttpMethod.Put, Place(id, "/tariff"), new { tariff = Tariff() }),
            (HttpMethod.Put, Place(id, "/reservable"), new { reservable = true }),
            (HttpMethod.Put, Place(id, "/active"), new { isActive = false }),
        })
        {
            var (status, _) = await customer.RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path} is the back office's");
        }
    }
}
