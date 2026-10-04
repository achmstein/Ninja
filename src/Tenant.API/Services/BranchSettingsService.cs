using Ninja.Tenant.API.IntegrationEvents;

namespace Ninja.Tenant.API.Services;

/// <summary>
/// The one place a branch's operational flags change — from the settings
/// endpoint (the admin app and the till's pause toggles), from the branch's
/// own edit, and from the shift events Sales publishes. Every change goes out
/// as <see cref="BranchSettingsChangedIntegrationEvent"/>, saved with it in
/// the outbox (<see cref="TenantEvents"/>), so Ordering, Spaces and
/// Notification keep their own copy of the flags (Ordering also of where the
/// branch is and how it delivers) even when the bus was down at the time.
/// </summary>
public class BranchSettingsService(
    TenantContext context,
    TenantEvents events,
    ILogger<BranchSettingsService> logger)
{
    /// <summary>
    /// Load, set, save, publish. A null flag leaves that setting as it was.
    /// Returns null when there is no such branch.
    /// </summary>
    public async Task<Model.Branch?> ApplyAsync(int branchId, bool? isOrderingEnabled, bool? isReservationsEnabled, bool? requireSignInForTableOrders = null, bool? isDeliveryEnabled = null, bool? requireSignInForDelivery = null)
    {
        var branch = await context.Branches.FindAsync(branchId);
        if (branch == null)
            return null;

        await ApplyAsync(branch, isOrderingEnabled, isReservationsEnabled, requireSignInForTableOrders, isDeliveryEnabled, requireSignInForDelivery);

        return branch;
    }

    /// <summary>
    /// Same on a branch the caller already loaded; whatever else is pending
    /// on the context is saved in the same transaction as the event.
    /// </summary>
    public async Task ApplyAsync(Model.Branch branch, bool? isOrderingEnabled, bool? isReservationsEnabled, bool? requireSignInForTableOrders = null, bool? isDeliveryEnabled = null, bool? requireSignInForDelivery = null)
    {
        if (isOrderingEnabled != null) branch.IsOrderingEnabled = isOrderingEnabled.Value;
        if (isReservationsEnabled != null) branch.IsReservationsEnabled = isReservationsEnabled.Value;
        if (requireSignInForTableOrders != null) branch.RequireSignInForTableOrders = requireSignInForTableOrders.Value;
        if (isDeliveryEnabled != null) branch.IsDeliveryEnabled = isDeliveryEnabled.Value;
        if (requireSignInForDelivery != null) branch.RequireSignInForDelivery = requireSignInForDelivery.Value;
        // Delivering needs a place to measure from and a distance to stop at. The
        // endpoints refuse a change that would take either from a delivering
        // branch; a shift event never touches them, so this only holds the line
        if (!branch.CanDeliver) branch.IsDeliveryEnabled = false;

        await events.SaveAndPublishAsync(Changed(branch));

        logger.LogInformation(
            "Branch {BranchId} settings: ordering {Ordering}, reservations {Reservations}, delivery {Delivery} within {RadiusKm} km, fee {Fee}, minimum {Minimum}",
            branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled,
            branch.IsDeliveryEnabled, branch.DeliveryRadiusKm, branch.DeliveryFee, branch.DeliveryMinimumOrder);
    }

    /// <summary>
    /// A new branch's flags, as they start: until this goes out Ordering,
    /// Spaces and Notification have no row for the branch.
    /// </summary>
    public Task PublishNewAsync(Model.Branch branch) => events.SaveAndPublishAsync(Changed(branch));

    // Named in full: the contracts suite finds a publisher by `new XIntegrationEvent(`
    private static BranchSettingsChangedIntegrationEvent Changed(Model.Branch branch) => new BranchSettingsChangedIntegrationEvent(
        branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders,
        branch.IsDeliveryEnabled, branch.Latitude, branch.Longitude,
        branch.DeliveryRadiusKm, branch.DeliveryFee, branch.DeliveryMinimumOrder,
        Version: DateTime.UtcNow.Ticks,
        RequireSignInForDelivery: branch.RequireSignInForDelivery);
}
