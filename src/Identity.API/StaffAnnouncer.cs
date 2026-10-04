using Ninja.EventBus.Abstractions;
using Ninja.Identity.API.Directory;
using Ninja.Identity.API.IntegrationEvents;
using Ninja.ServiceDefaults;

namespace Ninja.Identity.API;

/// <summary>
/// Says every staff account once each time the service starts, from the
/// directory's first load, so a service that keeps its own copy (Ordering's
/// riders, Notification's rider phones) has them without anyone touching an
/// account: a stack upgraded from before the event, a copy that was lost.
/// Saying the same thing again changes nothing on the other side. The bus
/// connects on its own thread, so the first tries may find it not yet open
/// and wait.
/// </summary>
public sealed class StaffAnnouncer(UserDirectory directory, IEventBus eventBus, ILogger<StaffAnnouncer> logger) : BackgroundService
{
    private static readonly TimeSpan FirstWait = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan LongestWait = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var wait = FirstWait;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await AnnounceAsync(stoppingToken);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Could not say the staff accounts yet; trying again in {Wait}", wait);
            }

            await Task.Delay(wait, stoppingToken);
            wait = TimeSpan.FromTicks(Math.Min(wait.Ticks * 2, LongestWait.Ticks));
        }
    }

    public async Task AnnounceAsync(CancellationToken ct = default)
    {
        var snapshot = await directory.GetAsync(ct);
        var staff = Staff(snapshot.Users).ToList();
        foreach (var @event in staff)
        {
            await eventBus.PublishAsync(@event);
        }
        logger.LogInformation("Said {Count} staff accounts", staff.Count);
    }

    /// <summary>The staff accounts among the users, as the event says them.</summary>
    public static IEnumerable<StaffAccountChangedIntegrationEvent> Staff(IEnumerable<DirectoryUser> users) =>
        users
            .Select(u => (User: u, Roles: u.RealmRoles.Where(r => RoleNames.Staff.Contains(r, StringComparer.OrdinalIgnoreCase)).ToArray()))
            .Where(s => s.Roles.Length > 0)
            .Select(s => new StaffAccountChangedIntegrationEvent(
                s.User.Id, PersonName.Display(s.User.FirstName, s.User.LastName), s.Roles, s.User.Branches.ToArray(), s.User.Enabled));
}
