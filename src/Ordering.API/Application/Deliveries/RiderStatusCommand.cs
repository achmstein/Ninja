#nullable enable
namespace Ninja.Ordering.API.Application.Deliveries;

/// <summary>The rider is on duty or off, at a branch, as their app says; a beat while it is open.</summary>
public record SetRiderStatusCommand(string UserId, string Name, int BranchId, bool OnDuty) : IRequest<RiderView>;

/// <summary>
/// Keeps the rider app's word on who is working where. Only a rider's own
/// account is kept: an admin or owner standing in through the rider app is
/// answered, but never listed as a rider at the till. The first beat and a
/// second one arriving together cannot both insert: on Postgres the row is
/// written in one statement that inserts or updates.
/// </summary>
public class SetRiderStatusCommandHandler(
    OrderingContext context,
    IIdentityService identity) : IRequestHandler<SetRiderStatusCommand, RiderView>
{
    public async Task<RiderView> Handle(SetRiderStatusCommand command, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var view = new RiderView
        {
            UserId = command.UserId,
            Name = command.Name,
            OnDuty = command.OnDuty,
            LastSeenAt = now,
            SignedIn = true,
        };

        if (!identity.IsInRole(DeliveryOptions.RiderRole))
        {
            return view;
        }

        var name = command.Name.Length <= DeliveryLimits.RiderName ? command.Name : command.Name[..DeliveryLimits.RiderName];

        if (context.Database.IsRelational())
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO ordering.riderstatuses ("UserId", "Name", "BranchId", "OnDuty", "LastSeenAt")
                VALUES ({command.UserId}, {name}, {command.BranchId}, {command.OnDuty}, {now})
                ON CONFLICT ("UserId") DO UPDATE
                SET "Name" = EXCLUDED."Name", "BranchId" = EXCLUDED."BranchId", "OnDuty" = EXCLUDED."OnDuty", "LastSeenAt" = EXCLUDED."LastSeenAt"
                """, cancellationToken);
            return view;
        }

        var status = await context.RiderStatuses.FindAsync([command.UserId], cancellationToken);
        if (status is null)
        {
            status = new RiderStatus { UserId = command.UserId };
            context.RiderStatuses.Add(status);
        }

        status.Name = name;
        status.BranchId = command.BranchId;
        status.OnDuty = command.OnDuty;
        status.LastSeenAt = now;
        await context.SaveChangesAsync(cancellationToken);
        return view;
    }
}
