namespace Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

/// <summary>Where a stay is in its life: Running → Ended, or Cancelled. (1 was Held, before the reservation became its own thing.)</summary>
public enum StayStatus
{
    /// <summary>The clock is running.</summary>
    Running = 2,

    /// <summary>The clock stopped; the cost is known.</summary>
    Ended = 3,

    /// <summary>Cut short by staff; nothing billed.</summary>
    Cancelled = 4,
}
