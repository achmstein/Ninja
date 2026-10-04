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
    /// Whether the business delivers at all: delivery bought, and not switched
    /// off by the owner. Fail-open: a stack that has never said delivers as
    /// each branch is set.
    /// </summary>
    Task<bool> IsDeliveryOnAsync();
}

/// <summary>Where a branch delivers from, how far, and what it asks.</summary>
public record DeliveryTerms(double Latitude, double Longitude, decimal RadiusKm, decimal Fee, decimal MinimumOrder)
{
    public int RadiusMeters => (int)(RadiusKm * 1000);
}
