#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>A step in a delivery's life, as one history row records it.</summary>
public enum DeliveryAction
{
    /// <summary>Given to a rider, when no one had it.</summary>
    Assigned,

    /// <summary>Taken back from its rider before it left: no one has it.</summary>
    Unassigned,

    /// <summary>Given to another rider before it left.</summary>
    Reassigned,

    Out,
    Delivered,

    /// <summary>Could not be handed over, with why.</summary>
    Failed,

    /// <summary>Brought back to the branch.</summary>
    Returned,

    /// <summary>The rider's cash counted in at the till, with how much.</summary>
    CashIn,
}

/// <summary>
/// One step of a delivery, as it happened: who it was with, what was done,
/// when, and by whom (the rider, or the till for them). Append-only and
/// written in the same transaction as the step, so the history is exactly
/// what the delivery went through, rider changes included; the order itself
/// keeps only where it is now.
/// </summary>
public class DeliveryAssignment
{
    public long Id { get; set; }

    public int OrderId { get; set; }

    public int BranchId { get; set; }

    /// <summary>The rider the delivery is with after this step; null once taken back.</summary>
    public string? RiderUserId { get; set; }

    public string? RiderName { get; set; }

    /// <summary>The rider who had it before, when this step changed hands (taken back, given to another).</summary>
    public string? PreviousRiderUserId { get; set; }

    public DeliveryAction Action { get; set; }

    public DateTime At { get; set; }

    /// <summary>Whose account took the step (the token's subject).</summary>
    public string? ActorUserId { get; set; }

    /// <summary>Their name as their token gave it, so the history reads without asking Identity.</summary>
    public string? ActorName { get; set; }

    /// <summary>"Rider" or "Till".</summary>
    public string ActorRole { get; set; } = string.Empty;

    /// <summary>What was counted in, for <see cref="DeliveryAction.CashIn"/>.</summary>
    public decimal? CashCollected { get; set; }

    /// <summary>Why it could not be handed over, for <see cref="DeliveryAction.Failed"/>.</summary>
    public string? Reason { get; set; }
}
