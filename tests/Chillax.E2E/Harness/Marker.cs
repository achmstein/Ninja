namespace Chillax.E2E.Harness;

/// <summary>
/// A position in one recorder's stream. Every recorder numbers what it
/// records; <c>Since(marker)</c> returns everything after that number.
/// </summary>
public readonly record struct Marker(long Seq)
{
    public static readonly Marker Start = new(0);
}

/// <summary>A marker in every recorder at once, taken before a step or a scenario.</summary>
public sealed record Checkpoint(Marker Events, Marker Hub, Marker Logs, DateTime UtcNow);
