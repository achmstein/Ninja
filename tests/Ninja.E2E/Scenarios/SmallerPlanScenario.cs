using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// A café on a smaller plan. The switches a plan does not include go off in
/// Tenant.API, the change rides the bus, and the services that own a module
/// stop taking what is not in it — Spaces keeps its own copy of the
/// switches and never calls Branch to ask.
///
/// The gateway's 402 page and the control plane clamping a switch to the
/// plan are not here: the AppHost has no per-tenant gateway and no
/// control-plane client in its realm. Tenant.FunctionalTests drives the
/// entitlements push and the module-off page; Control.AcceptanceTests
/// stamps a real Starter café. What this scenario proves is the half in
/// between: the switch, the event, and the service that obeys it.
/// </summary>
public sealed class SmallerPlanScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    private static object ATariff(decimal hourlyRate = 40m) => new
    {
        options = new[] { new { code = Codes.RateOption.Single, name = new { en = "Single" }, hourlyRate } },
        roundingMinutes = 15,
    };

    [Fact]
    public async Task The_clock_and_the_bookings_go_off_and_the_floor_stops_taking_them()
    {
        var before = await Owner.TenantAsync(Ct);
        Assert.True(before.Entitlements is { TimeBilling: true, Reservations: true },
            "the dev café is entitled to everything; this scenario turns the café's own switches off, not its plan");

        var placeId = 0;

        try
        {
            // 1. The café's switches go off, the way a smaller plan leaves them.
            var off = Step("Turn the clock and the bookings off");
            var smaller = await Owner.SetFeaturesAsync(before.Features.With(timeBilling: false, reservations: false), Ct);
            Assert.False(smaller.Features.TimeBilling);
            Assert.False(smaller.Features.Reservations);
            Assert.True(smaller.Entitlements.TimeBilling, "what the plan allows has not changed - the café's own switch has");
            Assert.Equal(before.Features.Loyalty, smaller.Features.Loyalty);

            var told = await ExpectEventAsync(off, "TenantFeaturesChanged", e => !e.Bool("TimeBilling"));
            Assert.False(told.Bool("Reservations"), "the one event carries every switch, so a service reads them together");

            // 2. A plain table is still a table: what a café keeps whatever it pays for.
            placeId = await Owner.CreatePlaceAsync($"Plan table {DateTime.UtcNow:HHmmss}", Ct);
            var plain = await ExpectValueAsync("the new table on the floor", async () =>
                (await Cashier.PlacesAsync(Ct)).FirstOrDefault(p => p.Id == placeId));
            Assert.False(plain.IsTimed, "no clock, so no rate");
            Assert.False(plain.Reservable, "and no bookings, so it is not offered for one");

            // 3. Spaces stops taking a rate: its own projection of the switches, once the event lands.
            Step("Try to put the table on the clock");
            await ExpectRefusedAsync(() => Owner.TrySetTariffAsync(placeId, ATariff(), Ct), "Time billing is off",
                "Spaces refuses a rate once the switch has reached it");

            using (var withRate = await Owner.TryCreatePlaceAsync("A room that should not be", Ct, kind: 1, tariff: ATariff()))
            {
                Assert.Equal(HttpStatusCode.BadRequest, withRate.StatusCode);
                Assert.Contains("Time billing is off", await withRate.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
            }

            // 4. And it stops taking bookings, for the same reason.
            Step("Try to open the table to bookings");
            await ExpectRefusedAsync(() => Owner.TrySetReservableAsync(placeId, true, Ct), "Reservations are off",
                "Spaces refuses a booking once the switch has reached it");

            // 5. The plan comes back: the same two calls go through.
            var on = Step("Put the clock and the bookings back");
            var whole = await Owner.SetFeaturesAsync(before.Features, Ct);
            Assert.True(whole.Features is { TimeBilling: true, Reservations: true });
            await ExpectEventAsync(on, "TenantFeaturesChanged", e => e.Bool("TimeBilling"));

            await Eventually.Async(async () =>
            {
                using var r = await Owner.TrySetTariffAsync(placeId, ATariff(), Ct);
                return r.IsSuccessStatusCode;
            }, "Spaces to take a rate again", Ct, TimeSpan.FromSeconds(30));

            using (var reservable = await Owner.TrySetReservableAsync(placeId, true, Ct))
            {
                Assert.True(reservable.IsSuccessStatusCode, await reservable.Content.ReadAsStringAsync(Ct));
            }

            var timed = await ExpectValueAsync("the table on the clock", async () =>
                (await Cashier.PlacesAsync(Ct)).FirstOrDefault(p => p is { IsTimed: true } && p.Id == placeId));
            Assert.Equal(40m, timed.Rate(Codes.RateOption.Single));

            // 6. And the clock runs on it: the module is back, not merely switched on.
            var walkIn = Step("Start a walk-in on the table that got its rate back");
            var stayId = await Cashier.StartWalkInAsync(placeId, Ct);
            await ExpectEventAsync(walkIn, "SessionStarted", e => e.Int("ReservationId") == stayId);
            await Cashier.EndStayAsync(stayId, Ct);
            await ExpectEventAsync(walkIn, "SessionCompleted", e => e.Int("ReservationId") == stayId);
        }
        finally
        {
            // The floor and the brand as the next scenario expects them
            if (placeId > 0)
            {
                using (await Owner.TrySetReservableAsync(placeId, false, CancellationToken.None)) { }
                using (await Owner.TrySetTariffAsync(placeId, null, CancellationToken.None)) { }
                await Owner.DeletePlaceAsync(placeId, CancellationToken.None);
            }
            await Owner.SetFeaturesAsync(before.Features, CancellationToken.None);
        }
    }

    /// <summary>A call the plan is supposed to refuse, tried until the switch has reached the service that refuses it.</summary>
    private async Task ExpectRefusedAsync(Func<Task<HttpResponseMessage>> call, string because, string what)
    {
        string body = "";
        await Eventually.Async(async () =>
        {
            using var response = await call();
            body = await response.Content.ReadAsStringAsync(Ct);
            return response.StatusCode == HttpStatusCode.BadRequest && body.Contains(because, StringComparison.Ordinal);
        }, what, Ct, TimeSpan.FromSeconds(30));
    }
}
