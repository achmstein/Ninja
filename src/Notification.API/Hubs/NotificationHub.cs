using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.Hubs;

/// <summary>
/// Realtime updates for customers and staff.
///
/// The hub is open to anonymous connections so a guest — someone ordering
/// without an account — sees their order change state like anyone else.
/// Nothing is broadcast on connect: a caller only ever receives what they
/// explicitly join, and the groups that carry privileged data are still
/// gated on the method.
/// </summary>
public class NotificationHub : Hub
{
    /// <summary>Guest ids are client-generated UUIDs; anything longer is not one.</summary>
    private const int MaxGuestIdLength = 64;

    public override async Task OnConnectedAsync()
    {
        // Auto-join user to their personal group for targeted notifications
        var userId = Context.User?.FindFirst("sub")?.Value;
        if (userId != null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// A guest calls this with the id their browser generated, to receive
    /// status updates for the orders they placed under it.
    ///
    /// It is a hub invocation rather than a query string parameter on purpose:
    /// the guest id is the secret that stands in for their account, and query
    /// strings end up in access logs where an invocation payload does not.
    ///
    /// Joining is all it grants — the group only ever carries an order id and
    /// a status, which is no more than the caller could already read by holding
    /// this same id.
    /// </summary>
    public async Task JoinGuestGroup(string guestId)
    {
        // Signed-in callers have their own group; ignore stray or oversized ids
        // rather than letting arbitrary strings name a group
        if (Context.User?.FindFirst("sub")?.Value != null
            || string.IsNullOrWhiteSpace(guestId)
            || guestId.Length > MaxGuestIdLength)
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"guest:{guestId}");
    }

    /// <summary>The group every phone at a place listens on for the sitting ending.</summary>
    public static string PlaceGroup(int placeId) => $"place:{placeId}";

    /// <summary>
    /// A customer who scanned a table's code calls this to hear when the
    /// sitting there ends — the bill paid or voided — whether or not they
    /// ordered anything themselves (docs/visit-tab.html). Open to anyone,
    /// guests included: the group only ever carries "this table is done",
    /// which is nothing a place id alone did not already let them ask.
    /// </summary>
    public async Task JoinPlaceGroup(int placeId)
    {
        if (placeId <= 0) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, PlaceGroup(placeId));
    }

    public async Task LeavePlaceGroup(int placeId) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, PlaceGroup(placeId));

    /// <summary>
    /// Client calls this to receive room/session status updates
    /// </summary>
    public async Task JoinRoomsGroup() =>
        await Groups.AddToGroupAsync(Context.ConnectionId, "rooms");

    /// <summary>
    /// Client calls this to stop receiving room/session status updates
    /// </summary>
    public async Task LeaveRoomsGroup() =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "rooms");

    /// <summary>
    /// Client calls this to receive staff-level updates (orders, reservations,
    /// service requests, tickets). "Pos" = Admin, Owner or Cashier — the till
    /// runs its floor on these updates too.
    /// </summary>
    [Authorize(Policy = "Pos")]
    public async Task JoinAdminGroup() =>
        await Groups.AddToGroupAsync(Context.ConnectionId, "admin");

    /// <summary>
    /// Client calls this to stop receiving admin-level updates
    /// </summary>
    public async Task LeaveAdminGroup() =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admin");
}
