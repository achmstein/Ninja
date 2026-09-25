using Ninja.Branch.API.IntegrationEvents;
using Ninja.EventBus.Abstractions;

namespace Ninja.Branch.API.Services;

/// <summary>
/// The one place a branch's operational flags change — from the settings
/// endpoint (the admin app and the till's pause toggles) and from the shift
/// events Sales publishes. Every change goes out as
/// <see cref="BranchSettingsChangedIntegrationEvent"/> so Ordering, Spaces and
/// Notification keep their own copy of the flags.
/// </summary>
public class BranchSettingsService(
    BranchContext context,
    IEventBus eventBus,
    ILogger<BranchSettingsService> logger)
{
    /// <summary>
    /// Load, set, save, publish. A null flag leaves that setting as it was.
    /// Returns null when there is no such branch.
    /// </summary>
    public async Task<Model.Branch?> ApplyAsync(int branchId, bool? isOrderingEnabled, bool? isReservationsEnabled, bool? requireSignInForTableOrders = null)
    {
        var branch = await context.Branches.FindAsync(branchId);
        if (branch == null)
            return null;

        await ApplyAsync(branch, isOrderingEnabled, isReservationsEnabled, requireSignInForTableOrders);

        return branch;
    }

    /// <summary>
    /// Same on a branch the caller already loaded; whatever else is pending
    /// on the context is saved in the same call.
    /// </summary>
    public async Task ApplyAsync(Model.Branch branch, bool? isOrderingEnabled, bool? isReservationsEnabled, bool? requireSignInForTableOrders = null)
    {
        if (isOrderingEnabled != null) branch.IsOrderingEnabled = isOrderingEnabled.Value;
        if (isReservationsEnabled != null) branch.IsReservationsEnabled = isReservationsEnabled.Value;
        if (requireSignInForTableOrders != null) branch.RequireSignInForTableOrders = requireSignInForTableOrders.Value;

        await context.SaveChangesAsync();

        logger.LogInformation(
            "Branch {BranchId} settings: ordering {Ordering}, reservations {Reservations}",
            branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled);

        await PublishAsync(branch);
    }

    /// <summary>
    /// Every branch's flags again, unchanged: for a café-wide setting the
    /// branch event carries, when it changed.
    /// </summary>
    public async Task PublishAllAsync()
    {
        foreach (var branch in await context.Branches.AsNoTracking().ToListAsync())
        {
            await PublishAsync(branch);
        }
    }

    /// <summary>
    /// A new branch's flags, as they start: until this goes out Ordering has
    /// no row for the branch and takes every café-wide setting it carries as off.
    /// </summary>
    public Task PublishNewAsync(Model.Branch branch) => PublishAsync(branch);

    private async Task PublishAsync(Model.Branch branch)
    {
        // Whether a guest may order away from a table is the café's, not the
        // branch's; it rides here because this is the event Ordering projects
        var guestOrdersAnywhere = await context.Tenants.AsNoTracking()
            .Where(t => t.Id == Model.Tenant.SingletonId)
            .Select(t => t.GuestOrdersAnywhere)
            .SingleOrDefaultAsync();

        await eventBus.PublishAsync(new BranchSettingsChangedIntegrationEvent(
            branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders, guestOrdersAnywhere));
    }
}
