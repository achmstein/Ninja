#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// A staff account as Identity last described it, kept for the riders among
/// them: who may be given a delivery, under what name, at which branches.
/// Kept from Identity's StaffAccountChangedIntegrationEvent — Ordering never
/// calls Identity. A row stays when the account stops being a rider or is
/// disabled (<see cref="IsRider"/>, <see cref="Enabled"/>), so a late event
/// about it cannot bring it back.
/// </summary>
public class RiderAccount
{
    /// <summary>The account (the token's subject).</summary>
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>The branches the owner gave it.</summary>
    public List<int> Branches { get; set; } = [];

    /// <summary>It holds the Rider role.</summary>
    public bool IsRider { get; set; }

    public bool Enabled { get; set; }

    /// <summary>CreationDate of the last event applied: the out-of-order guard.</summary>
    public DateTime UpdatedAt { get; set; }
}
