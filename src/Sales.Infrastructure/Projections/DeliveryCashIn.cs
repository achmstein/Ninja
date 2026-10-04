#nullable enable
namespace Ninja.Sales.Infrastructure.Projections;

/// <summary>How a rider's cash for a delivery met its bill.</summary>
public enum DeliveryCashOutcome
{
    /// <summary>The cash came in before the bill landed; it settles the bill when it does.</summary>
    Pending = 0,

    /// <summary>The bill settled with it, to the cent.</summary>
    Settled = 1,

    /// <summary>The bill settled; the rider brought more than it came to (the difference is recorded).</summary>
    Over = 2,

    /// <summary>The rider brought less than the bill: it stays open for the till, the shortfall recorded.</summary>
    Short = 3,

    /// <summary>The till had already settled the bill by hand; the rider's cash changed nothing.</summary>
    SettledAtTill = 4,
}

/// <summary>
/// A rider's cash for one delivery, as Ordering said the till took it in:
/// what was collected and what the bill came to, and what became of it. It
/// waits here when the cash came in before the bill (the confirmation still on
/// its way), and records a difference instead of settling a bill silently for
/// an amount nobody collected. One per order.
/// </summary>
public class DeliveryCashIn
{
    public int OrderId { get; set; }

    public int BranchId { get; set; }

    /// <summary>The bill it settled, or would; null while it waits for the bill.</summary>
    public int? TicketId { get; set; }

    /// <summary>What the rider brought back.</summary>
    public decimal Collected { get; set; }

    /// <summary>What the bill came to when it met the cash; null while it waits.</summary>
    public decimal? BillTotal { get; set; }

    /// <summary>Collected less the bill: positive over, negative short, zero when right.</summary>
    public decimal? Difference => BillTotal is { } total ? Collected - total : null;

    public string? RiderName { get; set; }

    public DeliveryCashOutcome Outcome { get; set; }

    /// <summary>When the till took the rider's cash (the event's time).</summary>
    public DateTime ReceivedAt { get; set; }

    /// <summary>When it met its bill; null while it waits.</summary>
    public DateTime? ResolvedAt { get; set; }
}
