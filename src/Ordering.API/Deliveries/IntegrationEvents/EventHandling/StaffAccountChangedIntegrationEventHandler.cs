#nullable enable
using Ninja.Ordering.Infrastructure.Deliveries;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Keeps Ordering's list of rider accounts from Identity's word about staff:
/// an upsert of the account's row, guarded against out-of-order delivery. An
/// account that is not (or no longer) a rider, or is disabled, keeps its row
/// marked so; one never a rider is not recorded at all.
/// </summary>
public class StaffAccountChangedIntegrationEventHandler(
    OrderingContext context,
    ILogger<StaffAccountChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<StaffAccountChangedIntegrationEvent>
{
    public async Task Handle(StaffAccountChangedIntegrationEvent @event)
    {
        // Ids and flags only: a name is staff's, but nothing more is logged
        logger.LogInformation("Handling integration event: {IntegrationEventId} - staff account {UserId}", @event.Id, @event.UserId);

        if (string.IsNullOrWhiteSpace(@event.UserId))
        {
            return;
        }

        var isRider = (@event.Roles ?? []).Contains(DeliveryOptions.RiderRole, StringComparer.OrdinalIgnoreCase);
        var row = await context.RiderAccounts.FindAsync(@event.UserId);

        if (row is null)
        {
            // Nothing to remember about an account that never was a rider
            if (!isRider)
            {
                return;
            }

            row = new RiderAccount { UserId = @event.UserId };
            context.RiderAccounts.Add(row);
        }
        else if (@event.CreationDate <= row.UpdatedAt)
        {
            logger.LogInformation(
                "Staff account event from {EventAt} is not newer than the projection ({RowAt}) - skipped",
                @event.CreationDate, row.UpdatedAt);
            return;
        }

        if (!string.IsNullOrWhiteSpace(@event.Name))
        {
            var name = @event.Name.Trim();
            row.Name = name.Length <= DeliveryLimits.RiderName ? name : name[..DeliveryLimits.RiderName];
        }
        row.Branches = (@event.Branches ?? []).Distinct().Order().ToList();
        row.IsRider = isRider;
        row.Enabled = @event.Enabled;
        row.UpdatedAt = @event.CreationDate;

        await context.SaveChangesAsync();

        logger.LogInformation("Rider accounts projection: {UserId} rider {IsRider}, enabled {Enabled}", @event.UserId, isRider, @event.Enabled);
    }
}
