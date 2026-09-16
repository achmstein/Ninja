using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Microsoft.EntityFrameworkCore;
using SpacesContext = Chillax.Spaces.Infrastructure.SpacesContext;

namespace Chillax.Spaces.API.Application.Queries;

public class PlaceQueries(SpacesContext context) : IPlaceQueries
{
    private static readonly StayStatus[] OpenStatuses = [StayStatus.Held, StayStatus.Running];

    private IQueryable<Stay> OpenStays => context.Stays
        .AsNoTracking()
        .Include(s => s.Members)
        .Where(s => OpenStatuses.Contains(s.Status));

    private IQueryable<Stay> FullStays => context.Stays
        .AsNoTracking()
        .Include(s => s.Place)
        .Include(s => s.Members)
        .Include(s => s.Segments);

    public async Task<IEnumerable<PlaceViewModel>> GetPlacesAsync(int branchId, PlaceKind? kind = null, bool? timed = null)
    {
        var query = context.Places.AsNoTracking().Where(p => p.BranchId == branchId);
        if (kind is { } k)
            query = query.Where(p => p.Kind == k);
        var places = await query.OrderBy(p => p.Kind).ThenBy(p => p.Name.En).ToListAsync();
        if (timed is { } t)
            places = places.Where(p => p.IsTimed == t).ToList();

        var ids = places.Select(p => p.Id).ToList();
        var open = await OpenStays.Where(s => ids.Contains(s.PlaceId)).ToListAsync();

        return places.Select(p => p.ToViewModel(open.Where(s => s.PlaceId == p.Id).ToList())).ToList();
    }

    public async Task<IEnumerable<PlaceViewModel>> GetAvailablePlacesAsync(int branchId)
    {
        var places = await GetPlacesAsync(branchId, timed: true);
        return places.Where(p => p.CanReserve && p.Status == PlaceDisplayStatus.Available);
    }

    public async Task<PlaceViewModel?> GetPlaceByIdAsync(int placeId)
    {
        var place = await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.Id == placeId);
        if (place is null) return null;
        var open = await OpenStays.Where(s => s.PlaceId == placeId).ToListAsync();
        return place.ToViewModel(open);
    }

    // LEGACY(places): lookup by the old table sticker id — remove when the printed room/table stickers are reprinted with /p/{id}.
    public async Task<PlaceViewModel?> GetPlaceByLegacyTableIdAsync(int tableId)
    {
        var place = await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.LegacyTableId == tableId);
        return place is null ? null : await GetPlaceByIdAsync(place.Id);
    }

    public async Task<IEnumerable<StayViewModel>> GetCustomerStaysAsync(string customerId, int pageIndex = 0, int pageSize = 20)
    {
        // Owner or member. Paged: the app polls this, and a regular's history
        // is unbounded — recent stays are all it needs.
        var stays = await FullStays
            .Where(s => s.CustomerId == customerId || s.Members.Any(m => m.CustomerId == customerId))
            .OrderByDescending(s => s.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return stays.Select(s => s.ToViewModel()).ToList();
    }

    public async Task<IEnumerable<StayViewModel>> GetOpenStaysAsync(int branchId)
    {
        var stays = await FullStays
            .Where(s => OpenStatuses.Contains(s.Status))
            .Where(s => s.Place!.BranchId == branchId)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync();
        return stays.Select(s => s.ToViewModel()).ToList();
    }

    public async Task<StayViewModel?> GetStayByIdAsync(int stayId)
    {
        var stay = await FullStays.FirstOrDefaultAsync(s => s.Id == stayId);
        return stay?.ToViewModel();
    }

    public async Task<IEnumerable<StayViewModel>> GetPlaceStayHistoryAsync(int placeId, int limit = 20)
    {
        var stays = await FullStays
            .Where(s => s.PlaceId == placeId)
            .Where(s => s.Status == StayStatus.Ended || s.Status == StayStatus.Cancelled)
            .OrderByDescending(s => s.EndedAt ?? s.CreatedAt)
            .Take(limit)
            .ToListAsync();
        return stays.Select(s => s.ToViewModel()).ToList();
    }

    public async Task<PlaceScanViewModel?> GetScanInfoAsync(int placeId, string customerId)
    {
        var place = await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.Id == placeId);
        if (place is null) return null;

        var open = await OpenStays.Where(s => s.PlaceId == placeId).ToListAsync();
        var running = open.FirstOrDefault(s => s.Status == StayStatus.Running);
        var current = running ?? open.FirstOrDefault(s => s.Status == StayStatus.Held);

        return new PlaceScanViewModel
        {
            BranchId = place.BranchId,
            PlaceId = place.Id,
            Kind = place.Kind,
            PlaceName = place.Name,
            Status = ViewModelMapping.DisplayStatus(place, open),
            IsActive = place.IsActive,
            Tariff = place.Tariff?.ToViewModel(),
            IsTimed = place.IsTimed,
            HasOptions = place.HasOptions,
            CanReserve = place.CanReserve,
            TakesControllerRequests = place.TakesControllerRequests,
            HasRunningStay = running is not null,
            Stay = current?.ToPreview(place),
            IsAlreadyMember = running is not null && running.HasMember(customerId),
        };
    }

    public async Task<PaginatedResult<StayViewModel>> GetStayHistoryAsync(
        int branchId, int pageIndex, int pageSize, int? placeId = null, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var query = FullStays
            .Where(s => s.Place!.BranchId == branchId)
            .Where(s => s.Status == StayStatus.Ended || s.Status == StayStatus.Cancelled);

        if (placeId.HasValue)
            query = query.Where(s => s.PlaceId == placeId.Value);
        if (fromDate.HasValue)
            query = query.Where(s => (s.EndedAt ?? s.CreatedAt) >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(s => (s.EndedAt ?? s.CreatedAt) <= toDate.Value);

        var totalCount = await query.CountAsync();
        var stays = await query
            .OrderByDescending(s => s.EndedAt ?? s.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaginatedResult<StayViewModel>
        {
            Items = stays.Select(s => s.ToViewModel()).ToList(),
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount,
        };
    }

    public async Task<StayStats> GetStayStatsAsync(int branchId, DateTime fromDate, DateTime toDate, int tzOffsetMinutes)
    {
        // Materialized, not projected: the domain's rounding stays the one
        // source of billed hours; a range holds a few hundred stays at most.
        var stays = await FullStays
            .Where(s => s.Place!.BranchId == branchId)
            .Where(s => s.Status == StayStatus.Ended)
            .Where(s => (s.EndedAt ?? s.CreatedAt) >= fromDate && (s.EndedAt ?? s.CreatedAt) <= toDate)
            .ToListAsync();

        var rows = stays.Select(s => new
        {
            // JS getTimezoneOffset is UTC − local, so local = UTC − offset
            Date = DateOnly.FromDateTime((s.EndedAt ?? s.CreatedAt).AddMinutes(-tzOffsetMinutes)),
            s.PlaceId,
            PlaceKind = s.Place!.Kind,
            PlaceName = s.Place!.Name,
            Hours = s.CostBreakdown().Sum(c => c.Hours),
            Revenue = s.TotalCost ?? 0m,
        }).ToList();

        var days = rows
            .GroupBy(r => r.Date)
            .OrderBy(g => g.Key)
            .Select(g => new StayStatsDay { Date = g.Key, Stays = g.Count(), Hours = g.Sum(r => r.Hours), Revenue = g.Sum(r => r.Revenue) })
            .ToList();

        var places = rows
            .GroupBy(r => r.PlaceId)
            .Select(g => new StayStatsPlace
            {
                PlaceId = g.Key,
                PlaceKind = g.First().PlaceKind,
                PlaceName = g.First().PlaceName,
                Stays = g.Count(),
                Hours = g.Sum(r => r.Hours),
                Revenue = g.Sum(r => r.Revenue),
            })
            .OrderByDescending(p => p.Hours)
            .ToList();

        return new StayStats { Days = days, Places = places };
    }
}
