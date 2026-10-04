#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of the business's switches it owns a part of, kept up
/// to date from Tenant.API's TenantFeaturesChangedIntegrationEvent: Ordering
/// never calls Tenant.API. One row for the stack. No row means the stack has
/// never said, and delivery stands as each branch set it (fail-open), so a
/// fresh stack or the dev host never refuses a delivery for want of an event.
/// </summary>
public class TenantFeatures
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>The business's own delivery: bought, and not switched off by the owner.</summary>
    public bool Delivery { get; set; } = true;

    /// <summary>
    /// CreationDate of the last event applied: the out-of-order guard, so an
    /// older event arriving late does not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
