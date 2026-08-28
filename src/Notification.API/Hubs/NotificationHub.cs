using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
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
    /// Client calls this to receive admin-level updates (orders, reservations, service requests)
    /// </summary>
    [Authorize(Policy = "Admin")]
    public async Task JoinAdminGroup() =>
        await Groups.AddToGroupAsync(Context.ConnectionId, "admin");

    /// <summary>
    /// Client calls this to stop receiving admin-level updates
    /// </summary>
    public async Task LeaveAdminGroup() =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admin");
}
