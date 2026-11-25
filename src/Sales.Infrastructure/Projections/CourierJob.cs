#nullable enable
namespace Ninja.Sales.Infrastructure.Projections;

/// <summary>What became of a courier company's delivery, as far as the money goes.</summary>
public enum CourierJobOutcome
{
    /// <summary>The courier's collection was said before the bill landed; it settles the bill when it does.</summary>
    Pending = 0,

    /// <summary>The bill settled to the courier company, for its total.</summary>
    Settled = 1,

    /// <summary>The courier collected less than the bill: it stays open for the till, the shortfall recorded.</summary>
    Short = 2,

    /// <summary>The bill was settled already (by hand at the till, or paid online ahead): only the fee is owed.</summary>
    AlreadySettled = 3,

    /// <summary>It could not be handed over: nothing collected, and the company's fee still owed.</summary>
    Failed = 4,
}

/// <summary>
/// A delivery a courier company carried, as Ordering said: what its courier collected (the company
/// keeps it and owes it to the business), what the company charges for it, and what became of the
/// bill. A company's balance is what its jobs collected, less their fees, less what it paid out.
/// One per order.
/// </summary>
public class CourierJob
{
    public int OrderId { get; set; }

    public int BranchId { get; set; }

    /// <summary>The courier company, by Ordering's id for it.</summary>
    public int ProviderId { get; set; }

    /// <summary>Its name when it took the delivery.</summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>What the courier collected at the door; zero when paid online ahead or not handed over.</summary>
    public decimal Collected { get; set; }

    /// <summary>What the company charges the business for it.</summary>
    public decimal Fee { get; set; }

    /// <summary>The bill it settled, or would; null while it waits for the bill, or when it failed.</summary>
    public int? TicketId { get; set; }

    /// <summary>What the bill came to when it met the collection.</summary>
    public decimal? BillTotal { get; set; }

    public CourierJobOutcome Outcome { get; set; }

    /// <summary>When it was delivered, or could not be (the event's time).</summary>
    public DateTime At { get; set; }

    /// <summary>When it met its bill; null while it waits.</summary>
    public DateTime? ResolvedAt { get; set; }
}

/// <summary>
/// Money settled between the business and a courier company: positive, the company paid the business
/// what its couriers collected; negative, the business paid the company (fees more than collections,
/// as with orders paid online ahead). Recorded by hand in admin.
/// </summary>
public class CourierPayout
{
    public int Id { get; set; }

    public int ProviderId { get; set; }

    public string Provider { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    /// <summary>The day the money changed hands, as the admin says.</summary>
    public DateOnly PaidOn { get; set; }

    public string? Note { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public DateTime RecordedAt { get; set; }
}
