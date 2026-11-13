#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

/// <summary>
/// Reads Ordering's projection of the branch flags (see
/// Ninja.Ordering.Infrastructure.Projections.BranchSettings).
/// </summary>
public interface IBranchSettingsQueries
{
    /// <summary>
    /// Whether customers may place orders at this branch right now. Fail-open:
    /// a branch with no projection row is taking orders.
    /// </summary>
    Task<bool> IsOrderingEnabledAsync(int branchId);

    /// <summary>
    /// Whether an order to a table at this branch needs an account. Fail-open:
    /// a branch with no projection row takes guest table orders.
    /// </summary>
    Task<bool> RequiresSignInForTableOrdersAsync(int branchId);

    /// <summary>
    /// How the branch delivers, or null when it does not right now: delivery
    /// off, ordering paused, or a branch never heard of (fails closed).
    /// <paramref name="evenWhilePaused"/> is the till's: pausing the customers'
    /// orders does not stop the till taking one over the phone.
    /// </summary>
    Task<DeliveryTerms?> GetDeliveryTermsAsync(int branchId, bool evenWhilePaused = false);

    /// <summary>
    /// Every branch that delivers to customers right now, with its terms, for
    /// finding the one that serves an address. Empty while the business does
    /// not deliver. <paramref name="evenWhilePaused"/> is the till's: a branch
    /// that paused its customers' orders still takes one sent from another
    /// branch's till, and comes back flagged <see cref="BranchDeliveryTerms.Paused"/>.
    /// </summary>
    Task<IReadOnlyList<BranchDeliveryTerms>> GetDeliveringBranchesAsync(bool evenWhilePaused = false);

    /// <summary>
    /// Whether the business delivers at all: delivery bought, and not switched
    /// off by the owner. Fail-open: a stack that has never said delivers as
    /// each branch is set.
    /// </summary>
    Task<bool> IsDeliveryOnAsync();

    /// <summary>
    /// Whether customers may pay online for a delivery or an order they collect,
    /// before the business sees it: the owner turned it on (with online payments).
    /// Fail-closed: a stack that has never said takes no such order.
    /// </summary>
    Task<bool> IsPayAheadOnAsync();

    /// <summary>
    /// Whether a call centre takes the business's phone orders: the owner bought
    /// it and kept it on. A branch till then offers no other branch to send an
    /// order to. Fail-closed: a stack that has never said has no call centre.
    /// </summary>
    Task<bool> IsCallCentreOnAsync();
}

/// <summary>Where a branch delivers from, how far, and what it asks.</summary>
/// <param name="RadiusKm">How far the riders go, straight-line; 0 when the branch has only a drawn area.</param>
/// <param name="SignInRequired">A customer must be signed in to order delivery here (the till's phone orders are not held to it).</param>
/// <param name="Area">The area drawn on the map, as [lat, lng] points; when there is one it, not the radius, says where the branch delivers.</param>
/// <param name="Zones">The branch's named areas, in the owner's order: each says what is different there. None is the usual case.</param>
public record DeliveryTerms(double Latitude, double Longitude, decimal RadiusKm, decimal Fee, decimal MinimumOrder, bool SignInRequired = false, IReadOnlyList<double[]>? Area = null, IReadOnlyList<DeliveryZoneTerms>? Zones = null)
{
    /// <summary>The named areas, never null.</summary>
    public IReadOnlyList<DeliveryZoneTerms> NamedZones => Zones ?? [];

    /// <summary>The named area a point is in: the first in the owner's order whose shape takes it in, on or off. Null for none.</summary>
    public DeliveryZoneTerms? ZoneAt(double latitude, double longitude) => NamedZones.FirstOrDefault(z => z.Contains(latitude, longitude));

    /// <summary>The named area with this id, picked by name by staff; null when it is not this branch's.</summary>
    public DeliveryZoneTerms? ZoneById(int id) => NamedZones.FirstOrDefault(z => z.Id == id);

    /// <summary>The fee there: the area's when it is in one, the branch's own otherwise.</summary>
    public decimal FeeIn(DeliveryZoneTerms? zone) => zone?.Fee ?? Fee;

    /// <summary>The minimum there: the area's when it has one, the branch's own otherwise.</summary>
    public decimal MinimumIn(DeliveryZoneTerms? zone) => zone?.MinimumOrder ?? MinimumOrder;

    public int RadiusMeters => (int)(RadiusKm * 1000);

    /// <summary>The branch delivers to a drawn area rather than a circle.</summary>
    public bool HasArea => Area is { Count: >= 3 };

    /// <summary>How far a point is from the branch, as the crow flies: what puts the nearer of two branches first.</summary>
    public int DistanceTo(double latitude, double longitude) => Geo.DistanceMeters(Latitude, Longitude, latitude, longitude);

    /// <summary>
    /// Whether the branch brings orders to this point: inside its drawn area when it
    /// has one, otherwise within its radius. The one question of "does it deliver
    /// there", asked by the quote, resolve, the till's quote, the policy and the
    /// alternatives alike.
    /// </summary>
    public bool Covers(double latitude, double longitude) =>
        (HasArea ? Geo.Contains(Area!, latitude, longitude) : DistanceTo(latitude, longitude) <= RadiusMeters)
        // A named area drawn past the branch's own reach is somewhere it delivers too, while it is on
        || NamedZones.Any(z => z.IsOn && z.Contains(latitude, longitude));
}

/// <summary>
/// One of a branch's named delivery areas, as people here say where they live: its own fee, and
/// when the owner set them its own minimum and about how long a delivery there takes.
/// </summary>
/// <param name="MinimumOrder">Null for the branch's own minimum.</param>
/// <param name="IsOn">Off for a while: a customer there is told so, and the till is asked twice.</param>
/// <param name="Shape">The area on the map, [lat, lng] points; null when it is only a name, picked by staff.</param>
public record DeliveryZoneTerms(int Id, LocalizedText Name, decimal Fee, decimal? MinimumOrder, int? EtaMinutes, bool IsOn, IReadOnlyList<double[]>? Shape = null)
{
    /// <summary>Whether a point is inside the area's shape; never, for an area that is only a name.</summary>
    public bool Contains(double latitude, double longitude) => Shape is { Count: >= 3 } && Geo.Contains(Shape, latitude, longitude);
}

/// <param name="Paused">The branch paused its customers' orders; only the till's are read with it in.</param>
public record BranchDeliveryTerms(int BranchId, DeliveryTerms Terms, bool Paused = false);
