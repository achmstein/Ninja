#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// Whether a rider is working right now, at which branch, as their app last
/// said: "on duty" when they start, "off duty" when they stop, and a beat
/// while the app is open. The till offers riders on duty first. Not an
/// aggregate — the rider app's word, kept where the till can read it.
/// </summary>
public class RiderStatus
{
    /// <summary>The rider's account (the token's subject).</summary>
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int BranchId { get; set; }

    public bool OnDuty { get; set; }

    /// <summary>The last time the app was heard from.</summary>
    public DateTime LastSeenAt { get; set; }
}
