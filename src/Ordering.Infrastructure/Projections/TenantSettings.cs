#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of the café's settings — the ones that are the café's
/// and not any one branch's — kept up to date from Tenant.API's
/// TenantSettingsChangedIntegrationEvent. One row for the stack. No row means
/// the stack has never said, and every setting reads as off, as it always has.
/// </summary>
public class TenantSettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    /// <summary>
    /// A guest may order without a table — from anywhere, to collect. Every
    /// branch of the café, including one opened after it was switched on.
    /// </summary>
    public bool GuestOrdersAnywhere { get; set; }

    /// <summary>
    /// CreationDate of the last event applied — the out-of-order guard: an
    /// older event arriving late must not undo a newer one.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
