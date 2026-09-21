using Ninja.E2E.Actors;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// Reservations apart from stays (docs/spaces-plan.md): the till reserves a
/// room and the floor sees it held, a walk-in is refused until the party is
/// seated, seating hands over to a stay that Sales opens a bill for, a
/// reservation given up tells the floor and leaves no bill behind, a
/// customer's own reservation follows the one-at-a-time rule and lapses
/// on the till's confirm into a running clock, and a plain table the owner
/// opened to bookings is reserved for later, seated without any clock, and
/// closed again. Every closed reservation lands in the owner's history.
/// </summary>
public sealed class ReservationScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    private Task<PlaceView> PlaceAsync(string nameEn) => Cashier.PlaceAsync(nameEn, Ct);

    private const int PlaceHeld = 3;

    [Fact]
    public async Task Reserve_seat_cancel_and_the_owner_s_history()
    {
        // 1. The till reserves Room 1 for a party at the counter: staff see it, the room reads held.
        var room1 = await PlaceAsync("Room 1");
        var reserve = Step("Reserve Room 1 for a party at the counter");
        var reservationId = await Cashier.ReserveAsync(room1.Id, Ct, customerName: "The Ahmeds", partySize: 3);
        var reserved = await ExpectEventAsync(reserve, "PlaceReserved", e => e.Int("ReservationId") == reservationId);
        Assert.Equal(room1.Id, reserved.Int("PlaceId"));
        Assert.Equal(1, reserved.Int("BranchId"));
        Assert.Equal(3, reserved.Int("PartySize"));
        Assert.Null(reserved.Str("For")); // for now
        Assert.Null(reserved.Str("ExpiresAt")); // a staff reservation never lapses
        await ExpectRoomStatusAsync(reserve, "room_reserved", room1.Id);

        var open = await Cashier.OpenReservationsAsync(Ct);
        var mine = Assert.Single(open, r => r.Id == reservationId);
        Assert.Equal(ReservationStatuses.Requested, mine.Status);
        Assert.True(mine.IsHolding, "a reservation for now keeps the room from the moment it is made");
        Assert.True(mine.PlaceIsTimed);
        Assert.Equal(PlaceHeld, (await PlaceAsync("Room 1")).Status);

        // 2. A walk-in cannot take a reserved room.
        Step("Try to walk into the reserved room");
        using (var r = await Cashier.TryStartWalkInAsync(room1.Id, Ct))
        {
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains("reserved", await r.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);
        }

        // 3. The party arrives: seating starts the clock, Sales opens the room's bill on it.
        var seat = Step("Seat the party in Room 1");
        var stayId = await Cashier.SeatReservationAsync(reservationId, Ct, Codes.RateOption.Multi);
        Assert.NotNull(stayId);
        var started = await ExpectEventAsync(seat, "SessionStarted", e => e.Int("ReservationId") == stayId);
        Assert.Equal(room1.Id, started.Int("PlaceId"));
        Assert.Equal(Codes.RateOption.Multi, started.Str("OptionCode"));
        var stay = (await Cashier.StayAsync(stayId.Value, Ct))!;
        Assert.Equal(reservationId, stay.ReservationId);
        Assert.Equal("The Ahmeds", stay.CustomerName);
        var roomTicket = await ExpectValueAsync("Sales opened the room's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == stayId));
        Assert.Equal(room1.Id, roomTicket.PlaceId);
        Assert.DoesNotContain(await Cashier.OpenReservationsAsync(Ct), r => r.Id == reservationId);
        Assert.Contains(await Cashier.OpenStaysAsync(Ct), s => s.Id == stayId);
        await ExpectRoomStatusAsync(seat, "session_started", room1.Id);

        // 4. The clock ends as any walk-in's would; the reservation is history, seated.
        var end = Step("End the seated party's clock");
        await Cashier.EndStayAsync(stayId.Value, Ct);
        await ExpectEventAsync(end, "SessionCompleted", e => e.Int("ReservationId") == stayId);
        await ExpectEventAsync(end, "PlaceBecameAvailable", e => e.Int("PlaceId") == room1.Id);
        var seated = Assert.Single(await Owner.PlaceReservationsAsync(room1.Id, Ct), r => r.Id == reservationId);
        Assert.Equal(ReservationStatuses.Seated, seated.Status);
        Assert.Equal(stayId, seated.StayId);
        Assert.NotNull(seated.SeatedAt);

        // 5. Given up before anyone sat down: the floor is told the room is free, Sales has nothing to drop.
        var room2 = await PlaceAsync("Room 2");
        var giveUp = Step("Reserve Room 2 and give it up");
        var wrongId = await Cashier.ReserveAsync(room2.Id, Ct, customerName: "Nobody");
        await ExpectEventAsync(giveUp, "PlaceReserved", e => e.Int("ReservationId") == wrongId);
        await Cashier.CancelReservationAsync(wrongId, Ct);
        var cancelled = await ExpectEventAsync(giveUp, "ReservationCancelled", e => e.Int("ReservationId") == wrongId);
        Assert.False(cancelled.Bool("WasRunning"), "a reservation, not a clock cut short");
        await ExpectEventAsync(giveUp, "PlaceBecameAvailable", e => e.Int("PlaceId") == room2.Id);
        await ExpectRoomStatusAsync(giveUp, "reservation_cancelled", room2.Id);
        Assert.DoesNotContain(await Cashier.OpenTicketsAsync(Ct), t => t.PlaceId == room2.Id);
        Assert.DoesNotContain(await Cashier.OpenReservationsAsync(Ct), r => r.Id == wrongId);
        Assert.Equal(ReservationStatuses.Cancelled, Assert.Single(await Owner.PlaceReservationsAsync(room2.Id, Ct), r => r.Id == wrongId).Status);

        // 6. A customer reserves from the app, one at a time, and the till's Confirm starts the clock they asked for.
        var room3 = await PlaceAsync("Room 3");
        var customer = Step("The customer reserves Room 3 with the clock to start on confirm");
        var customerReservation = await Customer.ReserveAsync(room3.Id, Ct, startOnConfirm: true, optionCode: Codes.RateOption.Single);
        var customerReserved = await ExpectEventAsync(customer, "PlaceReserved", e => e.Int("ReservationId") == customerReservation);
        Assert.Equal(Customer.UserId, customerReserved.Str("CustomerId"));
        Assert.True(customerReserved.Bool("StartOnConfirm"));
        Assert.NotNull(customerReserved.Str("ExpiresAt")); // ten minutes to arrive
        var own = Assert.Single(await Customer.MyReservationsAsync(Ct), r => r.Id == customerReservation);
        Assert.Equal(ReservationStatuses.Requested, own.Status);
        Assert.Equal(Codes.RateOption.Single, own.RequestedOptionCode);

        using (var second = await Customer.TryReserveAsync(room2.Id, Ct))
        {
            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        }

        var confirm = Step("The till confirms: the party is seated and the clock runs at the rate they asked for");
        var confirmed = await Cashier.ConfirmReservationAsync(customerReservation, Ct);
        Assert.True(confirmed.Seated);
        Assert.NotNull(confirmed.StayId);
        var customerStarted = await ExpectEventAsync(confirm, "SessionStarted", e => e.Int("ReservationId") == confirmed.StayId);
        Assert.Equal(Codes.RateOption.Single, customerStarted.Str("OptionCode"));
        Assert.Equal(Customer.UserId, customerStarted.Str("CustomerId"));
        var customerStay = (await Cashier.StayAsync(confirmed.StayId!.Value, Ct))!;
        Assert.Contains(customerStay.Members, m => m.CustomerId == Customer.UserId && m.Role == "Owner");
        Assert.Equal(ReservationStatuses.Seated, Assert.Single(await Customer.MyReservationsAsync(Ct), r => r.Id == customerReservation).Status);
        using (var late = await Customer.TryCancelMyReservationAsync(customerReservation, Ct))
        {
            Assert.Equal(HttpStatusCode.BadRequest, late.StatusCode); // seated is seated
        }
        await Cashier.EndStayAsync(confirmed.StayId.Value, Ct);
        await ExpectEventAsync(confirm, "SessionCompleted", e => e.Int("ReservationId") == confirmed.StayId);

        // 7. A plain table: the owner opens it to bookings, the till books it for tonight,
        //    seating it starts no clock, and the owner can close it again once it is quiet.
        var table1 = await PlaceAsync("Table 1");
        Assert.False(table1.IsTimed);
        Assert.False(table1.Reservable);
        var table = Step("Open Table 1 to reservations, book it for later, seat the party");
        await Owner.SetReservableAsync(table1.Id, true, Ct);
        Assert.True((await PlaceAsync("Table 1")).CanReserve);
        var tonight = DateTime.UtcNow.AddHours(3);
        var tableReservation = await Cashier.ReserveAsync(table1.Id, Ct, customerName: "The Saras", @for: tonight, partySize: 4);
        var tableReserved = await ExpectEventAsync(table, "PlaceReserved", e => e.Int("ReservationId") == tableReservation);
        Assert.Equal("Table", tableReserved.Str("PlaceKind"));
        Assert.NotNull(tableReserved.Str("For"));
        var due = Assert.Single(await Cashier.OpenReservationsAsync(Ct), r => r.Id == tableReservation);
        Assert.False(due.IsHolding, "the table is anyone's until tonight");
        Assert.NotEqual(PlaceHeld, (await PlaceAsync("Table 1")).Status);

        Assert.Null(await Cashier.SeatReservationAsync(tableReservation, Ct, optionCode: null));
        await ExpectNoEventAsync(table, "SessionStarted");
        Assert.DoesNotContain(await Cashier.OpenReservationsAsync(Ct), r => r.Id == tableReservation);
        var seatedTable = Assert.Single(await Owner.PlaceReservationsAsync(table1.Id, Ct), r => r.Id == tableReservation);
        Assert.Equal(ReservationStatuses.Seated, seatedTable.Status);
        Assert.Null(seatedTable.StayId);
        await Owner.SetReservableAsync(table1.Id, false, Ct);
        Assert.False((await PlaceAsync("Table 1")).CanReserve);

        // 8. The owner's history has every closed reservation of the day, by the day it was for.
        Step("Read the owner's reservation history");
        var history = await Owner.ReservationHistoryAsync(Ct);
        var ids = history.Items.Select(r => r.Id).ToList();
        Assert.Contains(reservationId, ids);
        Assert.Contains(wrongId, ids);
        Assert.Contains(customerReservation, ids);
        Assert.Contains(tableReservation, ids);
        Assert.Equal(tableReservation, history.Items.First().Id); // tonight sorts above what was for now
        Assert.DoesNotContain(history.Items, r => r.Status is ReservationStatuses.Requested or ReservationStatuses.Confirmed);
        var byPlace = await Owner.ReservationHistoryAsync(Ct, placeId: room1.Id);
        Assert.All(byPlace.Items, r => Assert.Equal(room1.Id, r.PlaceId));
        Assert.Contains(byPlace.Items, r => r.Id == reservationId);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
