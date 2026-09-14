using Chillax.E2E.Actors;
using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// PlayStation rooms: a walk-in session opens a room bill in Sales, a
/// member joins, drinks land on the bill, the till cannot settle while the
/// clock runs, ending the session lands the time (none, under the 15-minute
/// rounding) and frees the room, and the cancel / empty / cancelled-with-
/// lines paths each leave the floor in the right state. Spaces publishes
/// these events without an outbox, so a missing one here is the first place
/// a lost message would show.
/// </summary>
public sealed class RoomSessionScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    private async Task<RoomView> RoomAsync(string nameEn)
        => (await Cashier.RoomsAsync(Ct)).FirstOrDefault(r => r.Name.En == nameEn)
           ?? throw new Xunit.Sdk.XunitException($"no room named {nameEn} on branch 1");

    [Fact]
    public async Task Walk_in_member_order_end_settle_and_the_cancel_paths()
    {
        var room1 = await RoomAsync("Room 1");
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);

        // 1. Walk in: the clock starts and Sales opens the room's bill.
        var start = Step("Start a walk-in session in Room 1");
        var sessionId = await Cashier.StartWalkInAsync(room1.Id, Ct);
        var started = await ExpectEventAsync(start, "SessionStarted", e => e.Int("ReservationId") == sessionId);
        Assert.Equal(room1.Id, started.Int("RoomId"));
        Assert.Equal(1, started.Int("BranchId"));

        var roomTicket = await ExpectValueAsync("Sales opened the room's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == sessionId));
        Assert.Equal("Room", roomTicket.Type);
        Assert.Equal(room1.Id, roomTicket.RoomId);
        Assert.Equal(0, roomTicket.LineCount);
        await ExpectEventAsync(start, "TicketUpdated", e => e.Int("TicketId") == roomTicket.Id);
        Assert.Contains(await Cashier.ActiveSessionsAsync(Ct), s => s.Id == sessionId);
        await ExpectRoomStatusAsync(start, "session_started", room1.Id);

        // 2. A friend with an account joins the session.
        var join = Step("Add the tester as a member of the session");
        await Cashier.AddMemberAsync(sessionId, Customer.UserId, Customer.DisplayName, Ct);
        await ExpectEventAsync(join, "SessionMemberJoined", e => e.Int("ReservationId") == sessionId);
        var session = (await Cashier.SessionAsync(sessionId, Ct))!;
        Assert.Contains(session.Members, m => m.CustomerId == Customer.UserId);

        // 3. A coffee for the room lands on the room bill (service charge applies: it is served).
        var order = Step("Ring up a coffee onto the room bill");
        var sale = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 1)), Ct, ticketId: roomTicket.Id);
        Assert.Equal(roomTicket.Id, sale.TicketId);
        var bill = Money.Bill(coffee.EffectivePrice, served: coffee.EffectivePrice, DaySetup.VatRate, DaySetup.ServiceRate); // 25 + 2.50 + 3.85
        var ticket = await TicketAsync(roomTicket.Id);
        Assert.Single(ticket.Lines);
        Assert.Equal(bill.ServiceCharge, ticket.ServiceCharge);
        Assert.Equal(bill.Vat, ticket.Vat);
        Assert.Equal(bill.Total, ticket.Total);

        // 4. The bill cannot be settled while the clock runs.
        Step("Try to settle while the session is running");
        using (var r = await Cashier.TrySettleAsync(roomTicket.Id, Ct, Tender.Cash(bill.Total)))
        {
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains("still running", await r.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);
        }

        // 5. End the session: time is rounded to the nearest quarter hour, so a
        //    short test session bills nothing; the completion still has to arrive.
        var end = Step("End the session");
        await Cashier.EndSessionAsync(sessionId, Ct);
        var endedEvent = await ExpectEventAsync(end, "SessionEnded", e => e.Int("ReservationId") == sessionId);
        Assert.Contains(endedEvent.Array("MemberUserIds"), m => m.GetString() == Customer.UserId);
        await ExpectEventAsync(end, "RoomBecameAvailable", e => e.Int("RoomId") == room1.Id);
        var completed = await ExpectEventAsync(end, "SessionCompleted", e => e.Int("ReservationId") == sessionId);
        Assert.Equal(0m, completed.Dec("SingleDuration"));
        Assert.Equal(0m, completed.Dec("TotalCost"));
        Assert.Equal(1, completed.Int("BranchId"));
        await ExpectEventAsync(end, "TicketUpdated", e => e.Int("TicketId") == roomTicket.Id);

        await ExpectAsync("Sales marked the session ended on the bill", async () =>
        {
            var t = await TicketAsync(roomTicket.Id);
            Assert.NotNull(t.SessionEndedAt);
            Assert.Single(t.Lines); // no time line under 7.5 minutes
        });
        Assert.DoesNotContain(await Cashier.ActiveSessionsAsync(Ct), s => s.Id == sessionId);
        await ExpectRoomStatusAsync(end, "session_ended", room1.Id);
        await ExpectRoomStatusAsync(end, "room_available", room1.Id);

        // 6. Now it settles.
        var settle = Step("Settle the room bill in cash");
        var receipt = await Cashier.SettleAsync(roomTicket.Id, Ct, Tender.Cash(bill.Total));
        Assert.Equal(0m, receipt.Change);
        var settled = await ExpectEventAsync(settle, "TicketSettled", e => e.Int("TicketId") == roomTicket.Id);
        Assert.Equal(0m, settled.Dec("TimeTotal"));
        Assert.Equal(bill.ServiceCharge, settled.Dec("ServiceCharge"));

        // 7. Cancel path: a session started by mistake in Room 2 takes its empty bill with it.
        var room2 = await RoomAsync("Room 2");
        var cancel = Step("Start Room 2 by mistake and cancel it");
        var wrongSession = await Cashier.StartWalkInAsync(room2.Id, Ct);
        var wrongTicket = await ExpectValueAsync("Sales opened Room 2's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == wrongSession));
        await Cashier.CancelSessionAsync(wrongSession, Ct);
        await ExpectEventAsync(cancel, "ReservationCancelled", e => e.Int("ReservationId") == wrongSession);
        await ExpectEventAsync(cancel, "RoomBecameAvailable", e => e.Int("RoomId") == room2.Id);
        await ExpectAsync("the empty Room 2 bill was discarded", async () =>
        {
            Assert.Null(await Cashier.TicketAsync(wrongTicket.Id, Ct));
            Assert.DoesNotContain(await Cashier.OpenTicketsAsync(Ct), t => t.Id == wrongTicket.Id);
        });
        await ExpectRoomStatusAsync(cancel, "reservation_cancelled", room2.Id);

        // 8. Empty path: a session that ends with nothing on it leaves no bill behind.
        var room3 = await RoomAsync("Room 3");
        var empty = Step("Start Room 3 and end it straight away");
        var emptySession = await Cashier.StartWalkInAsync(room3.Id, Ct);
        var emptyTicket = await ExpectValueAsync("Sales opened Room 3's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == emptySession));
        await Cashier.EndSessionAsync(emptySession, Ct);
        await ExpectEventAsync(empty, "SessionCompleted", e => e.Int("ReservationId") == emptySession);
        await ExpectAsync("the empty Room 3 bill was discarded", async () =>
            Assert.Null(await Cashier.TicketAsync(emptyTicket.Id, Ct)));

        // 9. Cancelled with lines: the bill stays for the owner to void.
        var room4 = await RoomAsync("Room 4");
        var cancelWithLines = Step("Start Room 4, ring up a tea, cancel the session, void the bill");
        var lateSession = await Cashier.StartWalkInAsync(room4.Id, Ct);
        var lateTicket = await ExpectValueAsync("Sales opened Room 4's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == lateSession));
        await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Tea, 1)), Ct, ticketId: lateTicket.Id);
        await Cashier.CancelSessionAsync(lateSession, Ct);
        await ExpectEventAsync(cancelWithLines, "ReservationCancelled", e => e.Int("ReservationId") == lateSession);
        await ExpectAsync("the bill stayed open, its session marked ended", async () =>
        {
            var t = await TicketAsync(lateTicket.Id);
            Assert.Equal("Open", t.Status);
            Assert.NotNull(t.SessionEndedAt);
        });
        await Owner.VoidAsync(lateTicket.Id, "wrong room", Ct);
        await ExpectEventAsync(cancelWithLines, "TicketVoided", e => e.Int("TicketId") == lateTicket.Id);
        Assert.Equal("Voided", (await TicketAsync(lateTicket.Id)).Status);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }

    /// <summary>
    /// The real time line needs a session long enough to round up to a
    /// quarter hour. Opt in with --filter-trait Category=Slow.
    /// </summary>
    [Fact]
    [Trait("Category", "Slow")]
    public async Task A_quarter_hour_session_bills_room_time()
    {
        var room1 = await RoomAsync("Room 1");
        var start = Step("Start a walk-in in Room 1 (Single)");
        var sessionId = await Cashier.StartWalkInAsync(room1.Id, Ct);
        var roomTicket = await ExpectValueAsync("Sales opened the room's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == sessionId));

        // Spaces rounds each mode's total to the NEAREST quarter hour, so a
        // mode needs 7.5+ minutes before it bills at all: 8 minutes of Single
        // is one quarter, and the seconds of Multi at the end are nothing.
        await Task.Delay(TimeSpan.FromMinutes(8), Ct);
        await Cashier.SetPlayerModeAsync(sessionId, Codes.PlayerMode.Multi, Ct);

        var end = Step("End after ~8 minutes of Single: one quarter hour billed, the Multi seconds not");
        await Cashier.EndSessionAsync(sessionId, Ct);
        var completed = await ExpectEventAsync(end, "SessionCompleted", e => e.Int("ReservationId") == sessionId);
        Assert.Equal(0.25m, completed.Dec("SingleDuration"));
        Assert.Equal(0m, completed.Dec("MultiDuration"));
        Assert.Equal(Money.Round(0.25m * room1.SingleRate), completed.Dec("SingleCost"));
        Assert.Equal(0m, completed.Dec("MultiCost"));
        Assert.Equal(completed.Dec("SingleCost"), completed.Dec("TotalCost"));
        Assert.True(completed.Dec("TotalCost") > 0m, "some time was billed");

        await ExpectAsync("Sales put the time on the bill", async () =>
        {
            var t = await TicketAsync(roomTicket.Id);
            var timeLines = t.Lines.Where(l => l.Source == "SessionTime").ToList();
            Assert.NotEmpty(timeLines);
            Assert.Equal(completed.Dec("TotalCost"), timeLines.Sum(l => l.Total));
            Assert.Equal(0m, t.ServiceCharge); // room time is not served
        });

        var settle = Step("Settle the room time in cash");
        var total = (await TicketAsync(roomTicket.Id)).Total;
        await Cashier.SettleAsync(roomTicket.Id, Ct, Tender.Cash(total));
        var settled = await ExpectEventAsync(settle, "TicketSettled", e => e.Int("TicketId") == roomTicket.Id);
        Assert.Equal(completed.Dec("TotalCost"), settled.Dec("TimeTotal"));
        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
    }
}
