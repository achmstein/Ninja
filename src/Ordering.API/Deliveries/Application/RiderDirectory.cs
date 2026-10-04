#nullable enable
using Microsoft.Extensions.Options;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>A rider the till may give a delivery to, as Ordering knows them.</summary>
public record KnownRider(string UserId, string Name);

/// <summary>
/// The branch's riders, from what Ordering keeps itself: the rider accounts
/// Identity announced (who may be given a delivery, under what name) and the
/// rider app's word on who is on duty. Never a call to Identity. Until the
/// first account is announced (a stack upgraded mid-way), the riders whose
/// app checked in at the branch stand in for the accounts.
/// </summary>
public interface IRiderDirectory
{
    /// <summary>The rider, if they may be given this branch's deliveries; null otherwise.</summary>
    Task<KnownRider?> FindAsync(string riderUserId, int branchId);

    /// <summary>The branch's riders for the till's picker: on duty first, the least busy of them first.</summary>
    Task<List<RiderView>> ListAsync(int branchId);
}

public class RiderDirectory(OrderingContext context, IOptions<DeliveryOptions> options) : IRiderDirectory
{
    public async Task<KnownRider?> FindAsync(string riderUserId, int branchId)
    {
        if (string.IsNullOrWhiteSpace(riderUserId))
        {
            return null;
        }

        if (await context.RiderAccounts.AnyAsync())
        {
            var account = await context.RiderAccounts.AsNoTracking()
                .FirstOrDefaultAsync(r => r.UserId == riderUserId && r.IsRider && r.Enabled);
            return account is not null && account.Branches.Contains(branchId) ? new KnownRider(account.UserId, account.Name) : null;
        }

        var status = await context.RiderStatuses.AsNoTracking()
            .FirstOrDefaultAsync(r => r.UserId == riderUserId && r.BranchId == branchId);
        return status is null ? null : new KnownRider(status.UserId, status.Name);
    }

    public async Task<List<RiderView>> ListAsync(int branchId)
    {
        var heardSince = DateTime.UtcNow - options.Value.RiderGone;
        List<(string UserId, string Name)> riders;

        if (await context.RiderAccounts.AnyAsync())
        {
            var accounts = await context.RiderAccounts.AsNoTracking()
                .Where(r => r.IsRider && r.Enabled)
                .ToListAsync();
            riders = accounts.Where(a => a.Branches.Contains(branchId)).Select(a => (a.UserId, a.Name)).ToList();
        }
        else
        {
            riders = (await context.RiderStatuses.AsNoTracking().Where(r => r.BranchId == branchId).ToListAsync())
                .Select(s => (s.UserId, s.Name)).ToList();
        }

        var ids = riders.Select(r => r.UserId).ToList();
        var statuses = await context.RiderStatuses.AsNoTracking()
            .Where(s => ids.Contains(s.UserId))
            .ToDictionaryAsync(s => s.UserId);

        // How many each has out, in one query: given to them, not yet delivered or brought back
        var outCounts = (await context.Orders.AsNoTracking()
                .Where(o => o.Delivery != null
                    && o.OrderStatus == OrderStatus.Confirmed
                    && o.VoidedAt == null
                    && o.Delivery.RiderUserId != null
                    && ids.Contains(o.Delivery.RiderUserId)
                    && o.Delivery.DeliveredAt == null
                    && o.Delivery.ReturnedAt == null)
                .Select(o => o.Delivery!.RiderUserId!)
                .ToListAsync())
            .GroupBy(id => id)
            .ToDictionary(g => g.Key, g => g.Count());

        var views = riders.Select(r =>
        {
            statuses.TryGetValue(r.UserId, out var status);
            return new RiderView
            {
                UserId = r.UserId,
                Name = r.Name,
                // On duty here, and heard from lately: on duty at another branch is not on duty here
                OnDuty = status is { OnDuty: true } && status.BranchId == branchId && status.LastSeenAt >= heardSince,
                LastSeenAt = status?.LastSeenAt,
                SignedIn = status is not null,
                Out = outCounts.GetValueOrDefault(r.UserId),
            };
        });

        // On duty first, the least busy of them first; then the rest by when they were last seen, then by name
        return views
            .OrderByDescending(r => r.OnDuty)
            .ThenBy(r => r.OnDuty ? r.Out : 0)
            .ThenByDescending(r => r.LastSeenAt)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
