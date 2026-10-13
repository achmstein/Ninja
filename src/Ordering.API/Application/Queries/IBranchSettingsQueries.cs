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
public record DeliveryTerms(double Latitude, double Longitude, decimal RadiusKm, decimal Fee, decimal MinimumOrder, bool SignInRequired = false, IReadOnlyList<double[]>? Area = null)
{
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
    public bool Covers(double latitude, double longitude) => HasArea
        ? Geo.Contains(Area!, latitude, longitude)
        : DistanceTo(latitude, longitude) <= RadiusMeters;
}

/// <param name="Paused">The branch paused its customers' orders; only the till's are read with it in.</param>
public record BranchDeliveryTerms(int BranchId, DeliveryTerms Terms, bool Paused = false);
