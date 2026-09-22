using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Microsoft.EntityFrameworkCore;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.Queries;

public class PlaceQueries(SpacesContext context) : IPlaceQueries
{
    private static readonly ReservationStatus[] OpenReservationStatuses = [ReservationStatus.Requested, ReservationStatus.Confirmed];

    private IQueryable<Stay> RunningStays => context.Stays
        .AsNoTracking()
        .Include(s => s.Members)
        .Where(s => s.Status == StayStatus.Running);

    /// <summary>The reservations that bear on a place right now: open ones (keeping it, or due), and a party seated at a plain table, which is theirs until the staff complete it.</summary>
    private IQueryable<Reservation> LiveReservations => context.Reservations
        .AsNoTracking()
        .Where(r => OpenReservationStatuses.Contains(r.Status) || (r.Status == ReservationStatus.Seated && r.StayId == null));

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
        var running = await RunningStays.Where(s => ids.Contains(s.PlaceId)).ToListAsync();
        var reserved = await LiveReservations.Where(r => ids.Contains(r.PlaceId)).ToListAsync();

        var now = DateTime.UtcNow;
        return places
            .Select(p => p.ToViewModel(
                running.FirstOrDefault(s => s.PlaceId == p.Id),
                reserved.Where(r => r.PlaceId == p.Id),
                now))
            .ToList();
    }

    public async Task<IEnumerable<PlaceViewModel>> GetAvailablePlacesAsync(int branchId)
    {
        var places = await GetPlacesAsync(branchId);
        return places.Where(p => p.CanReserve && p.Status == PlaceDisplayStatus.Available);
    }

    public async Task<PlaceViewModel?> GetPlaceByIdAsync(int placeId)
    {
        var place = await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.Id == placeId);
        if (place is null) return null;
        var running = await RunningStays.FirstOrDefaultAsync(s => s.PlaceId == placeId);
        var reserved = await LiveReservations.Where(r => r.PlaceId == placeId).ToListAsync();
        return place.ToViewModel(running, reserved, DateTime.UtcNow);
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
            .Where(s => s.Status == StayStatus.Running)
            .Where(s => s.Place!.BranchId == branchId)
            .OrderBy(s => s.StartedAt)
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

        var now = DateTime.UtcNow;
        var running = await RunningStays.FirstOrDefaultAsync(s => s.PlaceId == placeId);
        var reserved = await LiveReservations.Where(r => r.PlaceId == placeId).ToListAsync();
        var holding = reserved.Where(r => r.IsHolding(now)).Next(now);

        return new PlaceScanViewModel
        {
            BranchId = place.BranchId,
            PlaceId = place.Id,
            Kind = place.Kind,
            PlaceName = place.Name,
            Status = ViewModelMapping.DisplayStatus(place, running, reserved.Next(now), now, reserved.Seated()),
            IsActive = place.IsActive,
            Tariff = place.Tariff?.ToViewModel(),
            IsTimed = place.IsTimed,
            HasOptions = place.HasOptions,
            CanReserve = place.CanReserve,
            TakesControllerRequests = place.TakesControllerRequests,
            HasRunningStay = running is not null,
            Stay = running?.ToPreview(place),
            Reservation = holding?.ToPreview(place, now),
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

/// <summary>Reservations as the floor and the customer's phone read them.</summary>
public class ReservationQueries(SpacesContext context) : IReservationQueries
{
    private static readonly ReservationStatus[] OpenStatuses = [ReservationStatus.Requested, ReservationStatus.Confirmed];

    private IQueryable<Reservation> All => context.Reservations.AsNoTracking().Include(r => r.Place);

    public async Task<IEnumerable<ReservationViewModel>> GetOpenAsync(int branchId)
    {
        var now = DateTime.UtcNow;
        var open = await All
            .Where(r => r.BranchId == branchId)
            .Where(r => OpenStatuses.Contains(r.Status))
            .OrderBy(r => r.For ?? r.CreatedAt)
            .ToListAsync();
        return open.Select(r => r.ToViewModel(now)).ToList();
    }

    public async Task<IEnumerable<ReservationViewModel>> GetCustomerReservationsAsync(string customerId, int pageIndex = 0, int pageSize = 20)
    {
        var now = DateTime.UtcNow;
        var mine = await All
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return mine.Select(r => r.ToViewModel(now)).ToList();
    }

    public async Task<ReservationViewModel?> GetByIdAsync(int reservationId)
    {
        var r = await All.FirstOrDefaultAsync(x => x.Id == reservationId);
        return r?.ToViewModel(DateTime.UtcNow);
    }

    // History is what is over, newest first by the day it was for: a
    // booking made a week ahead sits with the day it was honoured (or
    // missed), not the day it was made. A party still seated is not history.
    private IQueryable<Reservation> Closed => All.Where(r => !OpenStatuses.Contains(r.Status) && r.Status != ReservationStatus.Seated);

    public async Task<IEnumerable<ReservationViewModel>> GetPlaceHistoryAsync(int placeId, int limit = 20)
    {
        var now = DateTime.UtcNow;
        var past = await Closed
            .Where(r => r.PlaceId == placeId)
            .OrderByDescending(r => r.For ?? r.CreatedAt)
            .Take(limit)
            .ToListAsync();
        return past.Select(r => r.ToViewModel(now)).ToList();
    }

    public async Task<PaginatedResult<ReservationViewModel>> GetHistoryAsync(
        int branchId, int pageIndex, int pageSize, int? placeId = null, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var query = Closed.Where(r => r.BranchId == branchId);
        if (placeId.HasValue)
            query = query.Where(r => r.PlaceId == placeId.Value);
        if (fromDate.HasValue)
            query = query.Where(r => (r.For ?? r.CreatedAt) >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(r => (r.For ?? r.CreatedAt) <= toDate.Value);

        var now = DateTime.UtcNow;
        var totalCount = await query.CountAsync();
        var page = await query
            .OrderByDescending(r => r.For ?? r.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaginatedResult<ReservationViewModel>
        {
            Items = page.Select(r => r.ToViewModel(now)).ToList(),
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount,
        };
    }
}
