using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.Queries;

/// <summary>What a screen shows for a place: its physical state plus whether a hold is pending.</summary>
public enum PlaceDisplayStatus
{
    Available = 1,
    Occupied = 2,
    Held = 3,
    OutOfService = 4,
}

public record RateOptionViewModel
{
    public string Code { get; init; } = "";
    public LocalizedText Name { get; init; } = new();
    public decimal HourlyRate { get; init; }
}

public record TariffViewModel
{
    public List<RateOptionViewModel> Options { get; init; } = new();
    public int RoundingMinutes { get; init; } = 15;
}

public record PlaceViewModel
{
    public int Id { get; init; }
    public PlaceKind Kind { get; init; }
    public LocalizedText Name { get; init; } = new();
    public LocalizedText? Description { get; init; }
    public int BranchId { get; init; }
    public PlaceDisplayStatus Status { get; init; }
    public bool IsActive { get; init; }
    /// <summary>Null for a place that only receives orders.</summary>
    public TariffViewModel? Tariff { get; init; }
    public bool IsTimed { get; init; }
    public bool HasOptions { get; init; }
    public bool CanReserve { get; init; }
    public bool TakesControllerRequests { get; init; }
    /// <summary>The id a printed room sticker (/room/{id}) carries.</summary>
    public int? LegacyRoomId { get; init; }
    /// <summary>The id a printed table sticker (/table/{id}) carries.</summary>
    public int? LegacyTableId { get; init; }
    /// <summary>The held or running stay on it, if any.</summary>
    public StayPreviewViewModel? CurrentStay { get; init; }
}

public record StayCostViewModel
{
    public string OptionCode { get; init; } = "";
    public LocalizedText OptionName { get; init; } = new();
    public decimal HourlyRate { get; init; }
    public decimal Hours { get; init; }
    public decimal Cost { get; init; }
}

public record StayMemberViewModel
{
    public string CustomerId { get; init; } = "";
    public string? CustomerName { get; init; }
    public DateTime JoinedAt { get; init; }
    public string Role { get; init; } = "Member";
}

public record StaySegmentViewModel
{
    public string OptionCode { get; init; } = "";
    public LocalizedText OptionName { get; init; } = new();
    public decimal HourlyRate { get; init; }
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
}

public record StayViewModel
{
    public int Id { get; init; }
    public int PlaceId { get; init; }
    public PlaceKind PlaceKind { get; init; }
    public LocalizedText PlaceName { get; init; } = new();
    /// <summary>Null for a walk-in nobody has claimed yet.</summary>
    public string? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public DateTime CreatedAt { get; init; }
    /// <summary>When the hold lapses; only while held.</summary>
    public DateTime? ExpiresAt { get; init; }
    public bool StartOnConfirm { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? EndedAt { get; init; }
    public TariffViewModel Tariff { get; init; } = new();
    public string? CurrentOptionCode { get; init; }
    public LocalizedText? CurrentOptionName { get; init; }
    /// <summary>One line per rate option, in tariff order; zero hours included.</summary>
    public List<StayCostViewModel> Costs { get; init; } = new();
    public decimal? TotalCost { get; init; }
    /// <summary>The receipt the till settled the time on; null while unpaid.</summary>
    public int? ReceiptNumber { get; init; }
    public DateTime? PaidAt { get; init; }
    public int? TicketId { get; init; }
    public string? PaidWith { get; init; }
    public StayStatus Status { get; init; }
    public string? Notes { get; init; }
    public List<StayMemberViewModel> Members { get; init; } = new();
    public List<StaySegmentViewModel> Segments { get; init; } = new();
}

public record StayPreviewViewModel
{
    public int StayId { get; init; }
    public int PlaceId { get; init; }
    public LocalizedText PlaceName { get; init; } = new();
    public StayStatus Status { get; init; }
    public DateTime StartTime { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public int MemberCount { get; init; }
}

/// <summary>What a scanned QR resolves to: the place, what it can do, and the stay on it.</summary>
public record PlaceScanViewModel
{
    public int BranchId { get; init; }
    public int PlaceId { get; init; }
    public PlaceKind Kind { get; init; }
    public LocalizedText PlaceName { get; init; } = new();
    public PlaceDisplayStatus Status { get; init; }
    public bool IsActive { get; init; }
    public TariffViewModel? Tariff { get; init; }
    public bool IsTimed { get; init; }
    public bool HasOptions { get; init; }
    public bool CanReserve { get; init; }
    public bool TakesControllerRequests { get; init; }
    public bool HasRunningStay { get; init; }
    public StayPreviewViewModel? Stay { get; init; }
    public bool IsAlreadyMember { get; init; }
}

public record StayStats
{
    public List<StayStatsDay> Days { get; init; } = new();
    public List<StayStatsPlace> Places { get; init; } = new();
}

public record StayStatsDay
{
    /// <summary>Local calendar day (per the caller's tz offset)</summary>
    public DateOnly Date { get; init; }
    public int Stays { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

public record StayStatsPlace
{
    public int PlaceId { get; init; }
    public PlaceKind PlaceKind { get; init; }
    public LocalizedText PlaceName { get; init; } = new();
    public int Stays { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

/// <summary>Paginated result wrapper</summary>
public record PaginatedResult<T>
{
    public IEnumerable<T> Items { get; init; } = Enumerable.Empty<T>();
    public int PageIndex { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => PageIndex < TotalPages - 1;
    public bool HasPreviousPage => PageIndex > 0;
}

public static class ViewModelMapping
{
    public static TariffViewModel ToViewModel(this Tariff tariff) => new()
    {
        Options = tariff.Options.Select(o => new RateOptionViewModel { Code = o.Code, Name = o.Name, HourlyRate = o.HourlyRate }).ToList(),
        RoundingMinutes = tariff.RoundingMinutes,
    };

    public static PlaceDisplayStatus DisplayStatus(Place place, IEnumerable<Stay> openStays)
    {
        if (place.PhysicalStatus == PlaceStatus.OutOfService)
            return PlaceDisplayStatus.OutOfService;
        if (place.PhysicalStatus == PlaceStatus.Occupied)
            return PlaceDisplayStatus.Occupied;
        if (openStays.Any(s => s.Status == StayStatus.Running))
            return PlaceDisplayStatus.Occupied;
        if (openStays.Any(s => s.Status == StayStatus.Held))
            return PlaceDisplayStatus.Held;
        return PlaceDisplayStatus.Available;
    }

    public static StayPreviewViewModel ToPreview(this Stay stay, Place place) => new()
    {
        StayId = stay.Id,
        PlaceId = place.Id,
        PlaceName = place.Name,
        Status = stay.Status,
        StartTime = stay.StartedAt ?? stay.CreatedAt,
        ExpiresAt = stay.GetExpirationTime(),
        MemberCount = stay.Members.Count,
    };

    public static PlaceViewModel ToViewModel(this Place place, List<Stay> openStays)
    {
        var current = openStays.FirstOrDefault(s => s.Status == StayStatus.Running)
            ?? openStays.FirstOrDefault(s => s.Status == StayStatus.Held);
        return new PlaceViewModel
        {
            Id = place.Id,
            Kind = place.Kind,
            Name = place.Name,
            Description = place.Description,
            BranchId = place.BranchId,
            Status = DisplayStatus(place, openStays),
            IsActive = place.IsActive,
            Tariff = place.Tariff?.ToViewModel(),
            IsTimed = place.IsTimed,
            HasOptions = place.HasOptions,
            CanReserve = place.CanReserve,
            TakesControllerRequests = place.TakesControllerRequests,
            LegacyRoomId = place.LegacyRoomId,
            LegacyTableId = place.LegacyTableId,
            CurrentStay = current?.ToPreview(place),
        };
    }

    public static StayViewModel ToViewModel(this Stay stay)
    {
        var place = stay.Place;
        return new StayViewModel
        {
            Id = stay.Id,
            PlaceId = stay.PlaceId,
            PlaceKind = place?.Kind ?? PlaceKind.Room,
            PlaceName = place?.Name ?? new LocalizedText($"Place {stay.PlaceId}"),
            CustomerId = stay.CustomerId,
            CustomerName = stay.CustomerName,
            CreatedAt = stay.CreatedAt,
            ExpiresAt = stay.GetExpirationTime(),
            StartOnConfirm = stay.StartOnConfirm,
            StartedAt = stay.StartedAt,
            EndedAt = stay.EndedAt,
            Tariff = stay.Tariff.ToViewModel(),
            CurrentOptionCode = stay.CurrentOptionCode,
            CurrentOptionName = stay.CurrentOption?.Name,
            Costs = stay.CostBreakdown().Select(c => new StayCostViewModel
            {
                OptionCode = c.OptionCode,
                OptionName = c.OptionName,
                HourlyRate = c.HourlyRate,
                Hours = c.Hours,
                Cost = c.Cost,
            }).ToList(),
            TotalCost = stay.TotalCost,
            ReceiptNumber = stay.ReceiptNumber,
            PaidAt = stay.PaidAt,
            TicketId = stay.TicketId,
            PaidWith = stay.PaidWith,
            Status = stay.Status,
            Notes = stay.Notes,
            Members = stay.Members.Select(m => new StayMemberViewModel
            {
                CustomerId = m.CustomerId,
                CustomerName = m.CustomerName,
                JoinedAt = m.JoinedAt,
                Role = m.Role.ToString(),
            }).ToList(),
            Segments = stay.Segments.OrderBy(s => s.StartTime).Select(s => new StaySegmentViewModel
            {
                OptionCode = s.OptionCode,
                OptionName = stay.Tariff.Find(s.OptionCode)?.Name ?? new LocalizedText(s.OptionCode),
                HourlyRate = s.HourlyRate,
                StartTime = s.StartTime,
                EndTime = s.EndTime,
            }).ToList(),
        };
    }
}
