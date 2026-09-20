namespace Ninja.Control.API.Model;

/// <summary>
/// One payment a platform admin recorded against a tenant's subscription:
/// the amount, the period it covers, and how it was referenced. A payment
/// provider's webhook would create the same row; nothing else knows how
/// the money moved.
/// </summary>
public class Payment
{
    public long Id { get; set; }

    public Guid TenantId { get; set; }

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;

    public decimal Amount { get; set; }

    /// <summary>ISO 4217.</summary>
    public string Currency { get; set; } = "";

    public DateTimeOffset PeriodStart { get; set; }

    public DateTimeOffset PeriodEnd { get; set; }

    /// <summary>An invoice number, a transfer reference, whatever the payment came with.</summary>
    public string? Reference { get; set; }

    public string? Note { get; set; }

    /// <summary>Who recorded it: the platform admin's user id, or the provider's name once there is one.</summary>
    public string RecordedBy { get; set; } = "";
}
