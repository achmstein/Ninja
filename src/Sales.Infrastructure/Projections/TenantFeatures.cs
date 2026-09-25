#nullable enable
namespace Ninja.Sales.Infrastructure.Projections;

/// <summary>
/// Sales' own copy of the café's switches it owns a part of, kept up to date
/// from Tenant.API's TenantFeaturesChangedIntegrationEvent — Sales never
/// calls Tenant.API. One row for the stack. No row means the stack has never
/// said, and pay at table is off (fail-closed): taking a guest's money is
/// never something a missing event turns on.
/// </summary>
public class TenantFeatures
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>Guests may pay or split the bill online, through the café's own payment account.</summary>
    public bool PayAtTable { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
