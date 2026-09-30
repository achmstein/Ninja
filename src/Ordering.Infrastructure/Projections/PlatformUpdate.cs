#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>What the business tells the platform about one of its orders.</summary>
public enum PlatformUpdateKind
{
    Accepted,
    Rejected,
    Prepared,
    PickedUp,
}

/// <summary>
/// One change to report to a delivery platform, written in the same
/// transaction as the change itself and sent afterwards by the sender, which
/// retries until the platform takes it or it stops mattering. The platform
/// cancels an order nobody answers, so an accept must not be lost to a
/// moment's outage — nor sent before the order it accepts is saved.
/// </summary>
public class PlatformUpdate
{
    public int Id { get; set; }

    public int OrderId { get; set; }

    /// <summary>"Talabat".</summary>
    public string Platform { get; set; } = string.Empty;

    /// <summary>The platform's token for the order.</summary>
    public string Token { get; set; } = string.Empty;

    public PlatformUpdateKind Kind { get; set; }

    /// <summary>Where the platform said to send this change for this order.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>For a rejection: the platform's reason code.</summary>
    public string? Reason { get; set; }

    /// <summary>For an acceptance: when it will be ready (or delivered), as the platform asks.</summary>
    public DateTime? AcceptanceTime { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime NextAttemptAt { get; set; }

    public int Attempts { get; set; }

    /// <summary>Taken by the platform; null while it is still to send.</summary>
    public DateTime? SentAt { get; set; }

    /// <summary>Given up on: refused for good, or too late to matter.</summary>
    public DateTime? AbandonedAt { get; set; }

    public string? LastError { get; set; }
}
