#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of a branch's operational flags, kept up to date from
/// Tenant.API's BranchSettingsChangedIntegrationEvent — Ordering never calls
/// Tenant.API. No row means the branch has never been heard of and is treated
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
    /// Tenant.API's flag, projected here where CreateOrder can read it.
    /// </summary>
    public bool RequireSignInForTableOrders { get; set; }

    /// <summary>
    /// Ordering delivery needs an account at this branch; the till's phone
    /// orders are not held to it. Tenant.API's flag, projected here.
    /// </summary>
    public bool RequireSignInForDelivery { get; set; }

    /// <summary>
    /// The branch delivers with its own riders, within
    /// <see cref="DeliveryRadiusKm"/> of where it is. Unlike ordering, delivery
    /// fails closed: a branch never heard of does not deliver.
    /// </summary>
    public bool IsDeliveryEnabled { get; set; }

    /// <summary>Where the branch is; what a delivery's distance is measured from.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public decimal? DeliveryRadiusKm { get; set; }

    /// <summary>What a delivery adds to the bill.</summary>
    public decimal DeliveryFee { get; set; }

    /// <summary>The least the items must come to for a delivery; 0 for none.</summary>
    public decimal DeliveryMinimumOrder { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
