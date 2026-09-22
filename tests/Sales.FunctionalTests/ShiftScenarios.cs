using System.Net;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record ShiftView(int Id, int BranchId, string Status, decimal OpeningFloat, decimal? ClosingCount, decimal? ExpectedCash, decimal? OverShort, string OpenedBy, DateTime OpenedAt, DateTime? ClosedAt, List<MovementView> Movements);
public record MovementView(string Kind, decimal Amount, string? Reason);
public record OpenedShiftView(int ShiftId);

/// <summary>
/// The drawer's day: opened with a float, cash in and out during service,
/// counted and closed — and one shift at a time per counter.
/// </summary>
[TestClass]
public sealed class ShiftScenarios
{
    private const string Shifts = "/api/shifts";
    private const string Version = "api-version=1.0";

    // Each scenario runs its own counter, so one shift's day is not another's
    private static int _nextBranch = 100;
    private static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    private static Caller TillAt(int branch) => Suite.Sales.As(Persona.Cashier(branch), branch);

    private static string Url(string tail = "") => $"{Shifts}{tail}?{Version}";

    [TestMethod]
    public async Task A_drawer_is_opened_with_a_float_and_is_the_counters_current_shift()
    {
        var branch = NewBranch();
        var till = TillAt(branch);

        var opened = await till.PostAsync<OpenedShiftView>(Url("/open"), new { openingFloat = 500m });

        var current = await till.GetAsync<ShiftView>(Url("/current"));
        Assert.AreEqual(opened.ShiftId, current.Id);
        Assert.AreEqual(branch, current.BranchId);
        Assert.AreEqual("Open", current.Status);
        Assert.AreEqual(500m, current.OpeningFloat);
        Assert.IsNotNull(current.OpenedBy, "the drawer knows who opened it");
    }

    [TestMethod]
    public async Task A_counter_runs_one_shift_at_a_time()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        await till.PostAsync<OpenedShiftView>(Url("/open"), new { openingFloat = 200m });

        var (again, detail) = await till.RefusedAsync(HttpMethod.Post, Url("/open"), new { openingFloat = 200m });

        Assert.AreNotEqual(HttpStatusCode.OK, again, "a second drawer at the same counter is a mistake, not a shift");
        Assert.IsTrue(detail.Length > 0, "and the till is told why");
    }

    [TestMethod]
    public async Task Cash_goes_in_and_out_during_a_service_and_the_count_at_the_end_says_how_it_went()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shift = await till.PostAsync<OpenedShiftView>(Url("/open"), new { openingFloat = 1000m });

        // A supplier paid out of the drawer during the service
        var (paid, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/{shift.ShiftId}/movements"), new { type = 1, kind = 1, amount = 150m, reason = "Milk from the grocer" });
        Assert.AreEqual(HttpStatusCode.OK, paid, detail);

        var closed = await till.PostAsync<ShiftView>(Url($"/{shift.ShiftId}/close"), new { closingCount = 850m });

        Assert.AreEqual("Closed", closed.Status);
        Assert.AreEqual(850m, closed.ClosingCount);
        Assert.IsNotNull(closed.ClosedAt);
        Assert.AreEqual(0m, closed.OverShort, "a thousand in, a hundred and fifty out, eight hundred and fifty counted");

        var history = await till.GetAsync<List<ShiftView>>(Url());
        Assert.IsTrue(history.Any(s => s.Id == shift.ShiftId), "a closed shift is on the day's record");
    }

    [TestMethod]
    public async Task A_short_drawer_says_how_short()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shift = await till.PostAsync<OpenedShiftView>(Url("/open"), new { openingFloat = 1000m });

        var closed = await till.PostAsync<ShiftView>(Url($"/{shift.ShiftId}/close"), new { closingCount = 980m });

        Assert.AreEqual(-20m, closed.OverShort, "twenty missing is twenty missing");
    }

    [TestMethod]
    public async Task A_closed_drawer_takes_nothing_more()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shift = await till.PostAsync<OpenedShiftView>(Url("/open"), new { openingFloat = 100m });
        await till.PostAsync<ShiftView>(Url($"/{shift.ShiftId}/close"), new { closingCount = 100m });

        var (movement, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/{shift.ShiftId}/movements"), new { type = 1, kind = 1, amount = 10m, reason = "Too late" });
        Assert.AreNotEqual(HttpStatusCode.OK, movement);

        var (close, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/{shift.ShiftId}/close"), new { closingCount = 100m });
        Assert.AreNotEqual(HttpStatusCode.OK, close, "a drawer is closed once");
    }

    [TestMethod]
    public async Task The_drawer_is_the_tills_and_nobody_elses()
    {
        var customer = Suite.Sales.As(Persona.Customer(), Suite.Branch);

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Url("/current"), null),
            (HttpMethod.Post, Url("/open"), new { openingFloat = 1m }),
            (HttpMethod.Get, Url(), null),
        })
        {
            var (status, _) = await customer.RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path}");
        }
    }
}
