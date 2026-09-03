using Chillax.Branch.API.IntegrationEvents;
using Chillax.EventBus.Abstractions;

namespace Chillax.Branch.API.Services;

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
    public async Task<Model.Branch?> ApplyAsync(int branchId, bool? isOrderingEnabled, bool? isReservationsEnabled)
    {
        var branch = await context.Branches.FindAsync(branchId);
        if (branch == null)
            return null;

        await ApplyAsync(branch, isOrderingEnabled, isReservationsEnabled);

        return branch;
    }

    /// <summary>
    /// Same on a branch the caller already loaded; whatever else is pending
    /// on the context is saved in the same call.
    /// </summary>
    public async Task ApplyAsync(Model.Branch branch, bool? isOrderingEnabled, bool? isReservationsEnabled)
    {
        if (isOrderingEnabled != null) branch.IsOrderingEnabled = isOrderingEnabled.Value;
        if (isReservationsEnabled != null) branch.IsReservationsEnabled = isReservationsEnabled.Value;

        await context.SaveChangesAsync();

        logger.LogInformation(
            "Branch {BranchId} settings: ordering {Ordering}, reservations {Reservations}",
            branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled);

        await eventBus.PublishAsync(new BranchSettingsChangedIntegrationEvent(
            branch.Id, branch.IsOrderingEnabled, branch.IsReservationsEnabled));
    }
}
