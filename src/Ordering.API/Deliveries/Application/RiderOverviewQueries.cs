#nullable enable
using Microsoft.Extensions.Options;
using Ninja.Ordering.API.Application.Queries;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>Where a rider stands right now, as the admin reads it.</summary>
public enum RiderPresence
{
    /// <summary>Not on duty here (off, never opened the app, or on duty at another branch).</summary>
    Off,

    /// <summary>On duty here and heard from lately.</summary>
    Online,

    /// <summary>On duty here, but the app has not been heard from in a while (closed, no signal).</summary>
    Quiet,
}

/// <summary>The rider's presence from their app's last word: one rule for the admin and the tests.</summary>
public static class RiderPresenceRule
{
    public static RiderPresence Of(RiderStatus? status, int branchId, DateTime now, TimeSpan gone) =>
        status is not { OnDuty: true } || status.BranchId != branchId ? RiderPresence.Off
        : status.LastSeenAt >= now - gone ? RiderPresence.Online
        : RiderPresence.Quiet;

    /// <summary>
    /// The start of the caller's day, in UTC. <paramref name="tzOffsetMinutes"/>
    /// is JavaScript's getTimezoneOffset (UTC minus local), as the order
    /// history's day boundaries take it; Ordering keeps no time zone of its own.
    /// </summary>
    public static DateTime StartOfDay(DateTime utcNow, int tzOffsetMinutes)
    {
        var offset = TimeSpan.FromMinutes(tzOffsetMinutes);
        var localNow = utcNow - offset;
        return DateTime.SpecifyKind(localNow.Date + offset, DateTimeKind.Utc);
    }
}

/// <summary>The admin's view of the branch's riders: who is working now, and what each has done.</summary>
public interface IRiderOverviewQueries
{
    /// <summary>Every rider given the branch, Online first, with today's figures.</summary>
    Task<List<RiderOverview>> GetOverviewAsync(int branchId, int tzOffsetMinutes);

    /// <summary>
    /// Every delivery the rider was given at the branch in a window (when it
    /// was given), newest first, a page at a time, with the window's figures.
    /// One taken from them before it left still shows, as taken back or given
    /// to another; what they delivered, failed and handed in counts only for
    /// those that stayed theirs.
    /// </summary>
    Task<RiderDeliveryHistory> GetHistoryAsync(int branchId, string riderUserId, DateTime from, DateTime to, int page, int pageSize);

    /// <summary>One delivery's steps at the branch, in order; null when there is no such delivery here.</summary>
    Task<List<DeliveryTimelineStep>?> GetTimelineAsync(int branchId, int orderId);
}

/// <summary>What the rider history refuses.</summary>
public static class RiderHistoryErrors
{
    public const string RangeInvalid = "riders.range_invalid";
    public const string TimeZoneInvalid = "riders.tz_invalid";

    /// <summary>The longest window one history answer covers.</summary>
    public static readonly TimeSpan MaxRange = TimeSpan.FromDays(93);

    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 25;
}

public class RiderOverviewQueries(OrderingContext context, IOptions<DeliveryOptions> options) : IRiderOverviewQueries
{
    public async Task<List<RiderOverview>> GetOverviewAsync(int branchId, int tzOffsetMinutes)
    {
        var now = DateTime.UtcNow;
        var dayStart = RiderPresenceRule.StartOfDay(now, tzOffsetMinutes);

        // The riders: the accounts Identity announced (disabled ones too, said so), or
        // until the first is announced, the riders whose app checked in here
        List<(string UserId, string Name, bool Enabled)> riders;
        if (await context.RiderAccounts.AnyAsync())
        {
            riders = (await context.RiderAccounts.AsNoTracking().Where(r => r.IsRider).ToListAsync())
                .Where(a => a.Branches.Contains(branchId))
                .Select(a => (a.UserId, a.Name, a.Enabled))
                .ToList();
        }
        else
        {
            riders = (await context.RiderStatuses.AsNoTracking().Where(r => r.BranchId == branchId).ToListAsync())
                .Select(s => (s.UserId, s.Name, true))
                .ToList();
        }

        var ids = riders.Select(r => r.UserId).ToList();
        var statuses = await context.RiderStatuses.AsNoTracking()
            .Where(s => ids.Contains(s.UserId))
            .ToDictionaryAsync(s => s.UserId);

        // Today's and still-open deliveries of these riders here, in one query
        var rows = await context.Orders.AsNoTracking()
            .Where(o => o.Delivery != null && o.BranchId == branchId && o.VoidedAt == null)
            .Where(o => o.Delivery!.RiderUserId != null && ids.Contains(o.Delivery.RiderUserId))
            .Where(o => (o.OrderStatus == OrderStatus.Confirmed && o.Delivery!.DeliveredAt == null && o.Delivery.ReturnedAt == null)
                || o.Delivery!.DeliveredAt >= dayStart
                || o.Delivery.FailedAt >= dayStart
                || o.Delivery.CashHandedInAt >= dayStart)
            .Select(o => new
            {
                Rider = o.Delivery!.RiderUserId!,
                Open = o.OrderStatus == OrderStatus.Confirmed && o.Delivery.DeliveredAt == null && o.Delivery.ReturnedAt == null,
                o.Delivery.DeliveredAt,
                o.Delivery.FailedAt,
                o.Delivery.CashHandedInAt,
                o.Delivery.CashCollected,
            })
            .ToListAsync();
        var byRider = rows.ToLookup(r => r.Rider);

        return riders
            .Select(r =>
            {
                statuses.TryGetValue(r.UserId, out var status);
                var mine = byRider[r.UserId].ToList();
                var presence = RiderPresenceRule.Of(status, branchId, now, options.Value.RiderGone);
                return new RiderOverview
                {
                    UserId = r.UserId,
                    Name = r.Name,
                    Enabled = r.Enabled,
                    Status = presence.ToString(),
                    OnDuty = presence != RiderPresence.Off,
                    LastSeenAt = status?.LastSeenAt,
                    SignedIn = status is not null,
                    Out = mine.Count(m => m.Open),
                    DeliveredToday = mine.Count(m => m.DeliveredAt >= dayStart),
                    FailedToday = mine.Count(m => m.FailedAt >= dayStart),
                    CashCollectedToday = mine.Where(m => m.CashHandedInAt >= dayStart).Sum(m => m.CashCollected ?? 0m),
                };
            })
            // Online first, then on duty but quiet, then off; the busiest first, then by name
            .OrderBy(r => r.Status == nameof(RiderPresence.Online) ? 0 : r.Status == nameof(RiderPresence.Quiet) ? 1 : 2)
            .ThenByDescending(r => r.Out)
            .ThenByDescending(r => r.LastSeenAt)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<RiderDeliveryHistory> GetHistoryAsync(int branchId, string riderUserId, DateTime from, DateTime to, int page, int pageSize)
    {
        // Every time a delivery was given to this rider here, in the window: when first given
        var given = (await context.DeliveryAssignments.AsNoTracking()
                .Where(a => a.BranchId == branchId && a.RiderUserId == riderUserId
                    && (a.Action == DeliveryAction.Assigned || a.Action == DeliveryAction.Reassigned)
                    && a.At >= from && a.At < to)
                .Select(a => new { a.OrderId, a.At })
                .ToListAsync())
            .GroupBy(a => a.OrderId)
            .ToDictionary(g => g.Key, g => g.Min(a => a.At));

        // Deliveries from before the history was kept: those still with the rider, given in the window
        var unrecorded = await context.Orders.AsNoTracking()
            .Where(o => o.Delivery != null && o.BranchId == branchId && o.Delivery.RiderUserId == riderUserId)
            .Where(o => (o.Delivery!.AssignedAt ?? o.OrderDate) >= from && (o.Delivery.AssignedAt ?? o.OrderDate) < to)
            .Where(o => !context.DeliveryAssignments.Any(a => a.OrderId == o.Id))
            .Select(o => new { o.Id, At = o.Delivery!.AssignedAt ?? o.OrderDate })
            .ToListAsync();
        foreach (var o in unrecorded)
        {
            given.TryAdd(o.Id, o.At);
        }

        var ids = given.Keys.ToList();

        // What happened to each after it was given to them: taken back, or given to another
        var takenAway = (await context.DeliveryAssignments.AsNoTracking()
                .Where(a => ids.Contains(a.OrderId) && a.PreviousRiderUserId == riderUserId
                    && (a.Action == DeliveryAction.Unassigned || a.Action == DeliveryAction.Reassigned))
                .Select(a => new { a.OrderId, a.At, a.Action, a.RiderName })
                .ToListAsync())
            .ToLookup(a => a.OrderId);

        var all = await context.Orders.AsNoTracking()
            .Where(o => ids.Contains(o.Id) && o.Delivery != null)
            .Select(o => new
            {
                o.Id,
                o.OrderDate,
                CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                o.Delivery!.Address,
                o.Delivery.Building,
                o.Delivery.Floor,
                o.Delivery.Apartment,
                o.Delivery.Fee,
                o.Delivery.AssignedAt,
                o.Delivery.OutAt,
                o.Delivery.DeliveredAt,
                o.Delivery.FailedAt,
                o.Delivery.ReturnedAt,
                o.Delivery.FailureReason,
                o.Delivery.CashCollected,
                o.Delivery.CashHandedInAt,
                o.Delivery.RiderUserId,
                Total = OrderTotals.Of(o),
            })
            .WithOrderTotals()
            .ToListAsync();

        var rows = all
            .Select(o =>
            {
                var stillMine = o.RiderUserId == riderUserId;
                // The last time it was taken from them (a delivery given back and taken again shows its latest)
                var taken = stillMine ? null : takenAway[o.Id].OrderByDescending(a => a.At).FirstOrDefault();
                var stage = !stillMine
                    ? (taken?.Action == DeliveryAction.Reassigned ? "GivenToOther" : "TakenBack")
                    : (o.ReturnedAt != null ? DeliveryStage.Returned
                        : o.FailedAt != null ? DeliveryStage.Failed
                        : o.DeliveredAt != null ? DeliveryStage.Delivered
                        : o.OutAt != null ? DeliveryStage.OnTheWay
                        : DeliveryStage.Assigned).ToString();
                return new RiderDeliveryRow
                {
                    OrderNumber = o.Id,
                    CustomerName = o.CustomerName,
                    Address = o.Address,
                    Building = o.Building,
                    Floor = o.Floor,
                    Apartment = o.Apartment,
                    Total = o.Total,
                    Fee = o.Fee,
                    Stage = stage,
                    AssignedAt = given[o.Id],
                    StillWithRider = stillMine,
                    TakenFromRiderAt = taken?.At,
                    GivenToRiderName = taken?.Action == DeliveryAction.Reassigned ? taken.RiderName : null,
                    // What happened next was theirs only if it stayed theirs: one taken from them never left with them
                    OutAt = stillMine ? o.OutAt : null,
                    DeliveredAt = stillMine ? o.DeliveredAt : null,
                    FailedAt = stillMine ? o.FailedAt : null,
                    ReturnedAt = stillMine ? o.ReturnedAt : null,
                    FailureReason = stillMine ? o.FailureReason : null,
                    CashCollected = stillMine ? o.CashCollected : null,
                    CashHandedInAt = stillMine ? o.CashHandedInAt : null,
                    CashDifference = stillMine && o.CashCollected is { } collected ? collected - o.Total : null,
                    MinutesOutToDelivered = stillMine && o.OutAt is { } outAt && o.DeliveredAt is { } deliveredAt
                        ? (int)Math.Round((deliveredAt - outAt).TotalMinutes)
                        : null,
                };
            })
            .OrderByDescending(r => r.AssignedAt)
            .ThenByDescending(r => r.OrderNumber)
            .ToList();

        var timed = rows.Where(r => r.MinutesOutToDelivered != null).ToList();
        var summary = new RiderHistorySummary(
            Delivered: rows.Count(r => r.DeliveredAt != null),
            Failed: rows.Count(r => r.FailedAt != null),
            Returned: rows.Count(r => r.ReturnedAt != null),
            CashCollected: rows.Sum(r => r.CashCollected ?? 0m),
            CashDifferenceTotal: rows.Sum(r => r.CashDifference ?? 0m),
            AverageMinutesOutToDelivered: timed.Count == 0 ? null : Math.Round(timed.Average(r => r.MinutesOutToDelivered!.Value), 1));

        return new RiderDeliveryHistory
        {
            Items = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = rows.Count,
            Summary = summary,
        };
    }

    public async Task<List<DeliveryTimelineStep>?> GetTimelineAsync(int branchId, int orderId)
    {
        var exists = await context.Orders.AsNoTracking()
            .AnyAsync(o => o.Id == orderId && o.BranchId == branchId && o.Delivery != null);
        if (!exists)
        {
            return null;
        }

        var steps = await context.DeliveryAssignments.AsNoTracking()
            .Where(a => a.OrderId == orderId && a.BranchId == branchId)
            .OrderBy(a => a.At)
            .ThenBy(a => a.Id)
            .ToListAsync();

        // The rider a step took it from, by the name an earlier step gave them (or their account)
        var names = steps.Where(s => s.RiderUserId != null && s.RiderName != null)
            .GroupBy(s => s.RiderUserId!)
            .ToDictionary(g => g.Key, g => g.Last().RiderName!);
        var missing = steps.Select(s => s.PreviousRiderUserId).OfType<string>().Where(id => !names.ContainsKey(id)).Distinct().ToList();
        if (missing.Count > 0)
        {
            foreach (var account in await context.RiderAccounts.AsNoTracking().Where(r => missing.Contains(r.UserId)).ToListAsync())
            {
                names[account.UserId] = account.Name;
            }
        }

        return steps.Select(s => new DeliveryTimelineStep
        {
            Action = s.Action.ToString(),
            At = s.At,
            RiderUserId = s.RiderUserId,
            RiderName = s.RiderName,
            PreviousRiderUserId = s.PreviousRiderUserId,
            PreviousRiderName = s.PreviousRiderUserId is { } previous ? names.GetValueOrDefault(previous) : null,
            ActorUserId = s.ActorUserId,
            ActorName = s.ActorName,
            ActorRole = s.ActorRole,
            CashCollected = s.CashCollected,
            Reason = s.Reason,
        }).ToList();
    }
}
