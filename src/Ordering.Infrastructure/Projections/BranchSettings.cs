#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of a branch's operational flags, kept up to date from
/// Branch.API's BranchSettingsChangedIntegrationEvent — Ordering never calls
/// Branch.API. No row means the branch has never been heard of and is treated
/// as open (fail-open), so a fresh deployment never refuses orders for want
/// of an event.
/// </summary>
public class BranchSettings
{
    public int BranchId { get; set; }

    public bool IsOrderingEnabled { get; set; }

    public bool IsReservationsEnabled { get; set; }

    /// <summary>
    /// Ordering to a table needs an account at this branch: a guest may still
    /// browse, but only a signed-in customer can put an order on a table.
    /// Branch.API's flag, projected here where CreateOrder can read it.
    /// </summary>
    public bool RequireSignInForTableOrders { get; set; }

    /// <summary>
    /// A guest may order without a table — from anywhere, to collect. The
    /// café's setting, not the branch's, carried on every branch's event.
    /// </summary>
    public bool GuestOrdersAnywhere { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
