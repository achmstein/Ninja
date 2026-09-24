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

        // Stays first: a room ticket cannot be voided or settled while its clock runs.
        foreach (var stay in await cashier.OpenStaysAsync(ct))
        {
            try { await cashier.EndStayAsync(stay.Id, ct); }
            catch (ApiException) { await cashier.CancelStayAsync(stay.Id, ct); }
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

        await ResetKitchenAsync(day, ct);
    }

    /// <summary>
    /// One kitchen again: no paper waiting, and only the default station, which
    /// makes everything. A scenario that split the kitchen and failed half way
    /// must not leave the next one routing coffee to a bar.
    /// </summary>
    private static async Task ResetKitchenAsync(DaySetup day, CancellationToken ct)
    {
        var kitchen = day.Kitchen;

        foreach (var ticket in await kitchen.PrintJobsAsync(ct))
        {
            if (await kitchen.ClaimAsync(ticket.JobId, "e2e-housekeeping", ct))
                await kitchen.PrintedAsync(ticket.JobId, ct);
        }

        foreach (var station in await kitchen.StationsAsync(ct))
        {
            if (station.IsDefault)
                continue;
            // A station with work on its screen stays until the work is done
            foreach (var order in await kitchen.BoardAsync(ct, station.Id))
            {
                if (order.ReadyAt is null)
                    await kitchen.MarkStationReadyAsync(order.OrderNumber, station.Id, ct);
            }
            await day.Owner.DeleteStationAsync(station.Id, ct);
        }
    }
}
