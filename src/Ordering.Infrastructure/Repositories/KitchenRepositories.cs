#nullable enable
using Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

namespace Ninja.Ordering.Infrastructure.Repositories;

public class KitchenStationRepository(OrderingContext context) : IKitchenStationRepository
{
    public IUnitOfWork UnitOfWork => context;

    public async Task<List<KitchenStation>> GetForBranchAsync(int branchId)
    {
        var stations = await context.KitchenStations
            .Where(s => s.BranchId == branchId)
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.Id)
            .ToListAsync();

        if (stations.Count == 0)
        {
            var station = KitchenStation.NewDefault(branchId);
            context.KitchenStations.Add(station);
            stations.Add(station);
        }

        return stations;
    }

    public Task<KitchenStation?> GetAsync(int stationId) =>
        context.KitchenStations.FirstOrDefaultAsync(s => s.Id == stationId);

    public void Add(KitchenStation station) => context.KitchenStations.Add(station);

    public void Remove(KitchenStation station) => context.KitchenStations.Remove(station);

    public Task<bool> HasOpenPartsAsync(int stationId)
    {
        // The kitchen board's own window: older cards are history, not work
        var since = DateTime.UtcNow.AddHours(-24);
        return context.Orders
            .Where(o => o.OrderStatus == OrderStatus.Confirmed && o.ConfirmedAt >= since)
            .AnyAsync(o => o.StationParts.Any(p => p.StationId == stationId && p.ShowsOnScreen && p.ReadyAt == null));
    }
}

public class KitchenPrintJobRepository(OrderingContext context) : IKitchenPrintJobRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Task<KitchenPrintJob?> GetAsync(int jobId) =>
        context.KitchenPrintJobs.FirstOrDefaultAsync(j => j.Id == jobId);

    public void Add(KitchenPrintJob job) => context.KitchenPrintJobs.Add(job);

    public async Task<bool> TryClaimAsync(int jobId, string deviceId, DateTime now)
    {
        var lapsed = now - KitchenPrintJob.ClaimTimeout;

        // One conditional UPDATE: the database decides between two devices
        var claimed = await context.KitchenPrintJobs
            .Where(j => j.Id == jobId && j.PrintedAt == null && (j.ClaimedAt == null || j.ClaimedAt < lapsed))
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.ClaimedBy, deviceId)
                .SetProperty(j => j.ClaimedAt, now));

        return claimed == 1;
    }
}
