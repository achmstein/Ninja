namespace Chillax.Spaces.Domain.AggregatesModel.StayAggregate;

/// <summary>Where a stay is in its life: Held → Running → Ended, or Cancelled.</summary>
public enum StayStatus
{
    /// <summary>The customer asked for the place; the clock has not started and the hold expires.</summary>
    Held = 1,

    /// <summary>The clock is running.</summary>
    Running = 2,

    /// <summary>The clock stopped; the cost is known.</summary>
    Ended = 3,

    /// <summary>Given up before it ran, or cut short by staff.</summary>
    Cancelled = 4,
}
