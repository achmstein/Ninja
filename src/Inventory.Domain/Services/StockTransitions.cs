namespace Chillax.Inventory.Domain.Services;

/// <summary>
/// The crossings that matter, as pure rules over a before/after pair. A
/// level already at or below the line that moves further does not cross
/// it again; only the movement that takes it over the line counts.
/// </summary>
public static class StockTransitions
{
    /// <summary>Was in stock, now is not.</summary>
    public static bool CrossedToZero(decimal pre, decimal post) => pre > 0 && post <= 0;

    /// <summary>Was out, now is not.</summary>
    public static bool CrossedAboveZero(decimal pre, decimal post) => pre <= 0 && post > 0;

    /// <summary>Dropped to or below the reorder level on this movement.</summary>
    public static bool CrossedBelowReorder(decimal pre, decimal post, decimal? reorderLevel)
        => reorderLevel is { } level && pre > level && post <= level;
}
