using Ninja.EventBus.Events;

namespace Ninja.Identity.API.IntegrationEvents;

/// <summary>
/// A staff account as it stands now: made, its branches or name changed,
/// switched on or off, or gone (Enabled false, no roles). Said again for every
/// staff account each time Identity starts, so a service that keeps its own
/// copy (the riders Ordering may give a delivery to, the phones Notification
/// pushes a rider's deliveries to) has it without anyone touching the account.
/// Saying the same thing twice changes nothing on the other side.
/// </summary>
/// <param name="Roles">The staff roles it holds (Admin, Owner, Cashier, Kitchen, Rider); empty once it is gone.</param>
/// <param name="Branches">The branches it may work in; empty for an Owner, who holds them all.</param>
public record StaffAccountChangedIntegrationEvent(
    string UserId,
    string Name,
    string[] Roles,
    int[] Branches,
    bool Enabled) : IntegrationEvent;
