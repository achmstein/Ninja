using Ninja.E2E.Actors;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Fixtures;

/// <summary>
/// Puts branch 1 back to "nothing going on": no active room session, no
/// open ticket, no pending customer order, no open shift. Run before and
/// after every scenario so each starts from the same floor.
/// </summary>
public static class Housekeeping
{
    public static async Task ResetAsync(DaySetup day, CancellationToken ct)
    {
        var cashier = day.Cashier;
        var owner = day.Owner;

        // Sessions first: a room ticket cannot be voided or settled while its clock runs.
        foreach (var session in await cashier.ActiveSessionsAsync(ct))
        {
            try { await cashier.EndSessionAsync(session.Id, ct); }
            catch (ApiException) { await cashier.CancelSessionAsync(session.Id, ct); }
        }

        foreach (var order in await cashier.PendingAsync(ct))
        {
            try { await cashier.CancelOrderAsync(order.OrderNumber, ct); }
            catch (ApiException) { /* raced with a confirm; not ours to worry about */ }
        }

        await Eventually.Async(async () =>
        {
            var open = await cashier.OpenTicketsAsync(ct);
            foreach (var ticket in open)
            {
                var detail = await cashier.TicketAsync(ticket.Id, ct);
                if (detail is null)
                    continue;
                if (detail.SessionId is not null && detail.SessionEndedAt is null)
                    return false; // Sales has not yet seen the session end
                if (detail.Lines.Count == 0)
                    await cashier.DiscardAsync(ticket.Id, ct);
                else
                    await owner.VoidAsync(ticket.Id, "e2e housekeeping", ct);
            }
            return (await cashier.OpenTicketsAsync(ct)).Count == 0;
        }, "open tickets to be cleared", ct, TimeSpan.FromSeconds(30));

        var shift = await cashier.CurrentShiftAsync(ct);
        if (shift is not null)
            await cashier.CloseShiftAsync(shift.Id, shift.ExpectedInDrawer, ct);
    }
}
