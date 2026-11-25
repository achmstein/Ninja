#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// A job a connected courier company must be told to stop: the delivery was taken back, given to
/// someone else, or its bill voided. Saved with that step, in its transaction, and sent from here
/// until the company answers, so a company that was down at the moment still hears of it.
/// </summary>
public class CourierCancel
{
    public int Id { get; set; }

    public int CompanyId { get; set; }

    public string JobId { get; set; } = string.Empty;

    public int OrderId { get; set; }

    /// <summary>taken_back, reassigned or order_voided: what the company is told.</summary>
    public string Reason { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    /// <summary>When it is next tried: now at first, later after each failure.</summary>
    public DateTime NextAttemptAt { get; set; }

    public int Attempts { get; set; }

    /// <summary>The company took it (or did not know the job): done.</summary>
    public DateTime? SentAt { get; set; }

    /// <summary>Given up: refused for good, the company disconnected, or not taken within the day.</summary>
    public DateTime? AbandonedAt { get; set; }

    public string? LastError { get; set; }
}
