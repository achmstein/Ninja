using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.API.Application.Queries;

// ---------------------------------------------------------------------------
// LEGACY(places): the old /api/rooms and /api/tables view models and their mapping from Place/Stay — remove when every till and customer app is on /api/places and /api/stays.
// The shapes /api/rooms and /api/tables served before the Places remodel.
// Served for one release by the alias routes, mapped from Place and Stay, so
// the installed tills and the printed QR stickers keep working while the
// clients move to /api/places and /api/stays. Remove with the aliases.
// ---------------------------------------------------------------------------

// LEGACY(places): old room display status words — remove when every till and customer app is on /api/places and /api/stays.
public enum RoomDisplayStatus
{
    Available = 1,
    Occupied = 2,
    Reserved = 3,
    Maintenance = 4,
}

/// <summary>
/// LEGACY(places): old reservation status words — remove when every till and customer app is on /api/places and /api/stays.
/// The old reservation life, by the old names; same numbers as <see cref="StayStatus"/>.
/// </summary>
public enum ReservationStatus
{
    Reserved = 1,
    Active = 2,
    Completed = 3,
    Cancelled = 4,
}

// LEGACY(places): RoomViewModel, the old /api/rooms room shape with SingleRate/MultiRate — remove when every till and customer app is on /api/places and /api/stays.
public record RoomViewModel
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public LocalizedText? Description { get; init; }
    public decimal SingleRate { get; init; }
    public decimal MultiRate { get; init; }
    public RoomDisplayStatus DisplayStatus { get; init; }
}

// LEGACY(places): ReservationViewModel, the old session shape with RoomId/RoomName, Single/Multi rates, hours and costs and the PlayerMode word — remove when every till and customer app is on /api/places and /api/stays.
public record ReservationViewModel
{
    public int Id { get; init; }
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public decimal SingleRate { get; init; }
    public decimal MultiRate { get; init; }
    public string? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ActualStartTime { get; init; }
    public DateTime? EndTime { get; init; }
    public decimal? TotalCost { get; init; }
    public int? ReceiptNumber { get; init; }
    public DateTime? PaidAt { get; init; }
    public int? TicketId { get; init; }
    public string? PaidWith { get; init; }
    public string? CurrentPlayerMode { get; init; }
    public decimal SingleRoundedHours { get; init; }
    public decimal MultiRoundedHours { get; init; }
    public decimal SingleCost { get; init; }
    public decimal MultiCost { get; init; }
    public ReservationStatus Status { get; init; }
    public string? Notes { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public List<SessionMemberViewModel> Members { get; init; } = new();
    public List<SessionSegmentViewModel> Segments { get; init; } = new();
}

// LEGACY(places): old session stats shape (Rooms instead of Places) — remove when every till and customer app is on /api/places and /api/stays.
public record SessionStats
{
    public List<SessionStatsDay> Days { get; init; } = new();
    public List<SessionStatsRoom> Rooms { get; init; } = new();
}

// LEGACY(places): old per-day stats row (Sessions instead of Stays) — remove when every till and customer app is on /api/places and /api/stays.
public record SessionStatsDay
{
    public DateOnly Date { get; init; }
    public int Sessions { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

// LEGACY(places): old per-room stats row with RoomId/RoomName — remove when every till and customer app is on /api/places and /api/stays.
public record SessionStatsRoom
{
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public int Sessions { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

// LEGACY(places): old session member shape served inside ReservationViewModel — remove when every till and customer app is on /api/places and /api/stays.
public record SessionMemberViewModel
{
    public string CustomerId { get; init; } = "";
    public string? CustomerName { get; init; }
    public DateTime JoinedAt { get; init; }
    public string Role { get; init; } = "Member";
}

// LEGACY(places): old session segment shape with the PlayerMode word — remove when every till and customer app is on /api/places and /api/stays.
public record SessionSegmentViewModel
{
    public string PlayerMode { get; init; } = "";
    public decimal HourlyRate { get; init; }
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
}

// LEGACY(places): old scan session preview with RoomId/RoomName — remove when every till and customer app is on /api/places and /api/stays.
public record SessionPreviewViewModel
{
    public int SessionId { get; init; }
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public DateTime StartTime { get; init; }
    public int MemberCount { get; init; }
}

// LEGACY(places): old /api/rooms/{id}/scan shape with RoomId/RoomName and Single/Multi rates — remove when every till and customer app is on /api/places and /api/stays.
public record RoomScanViewModel
{
    public int BranchId { get; init; }
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public decimal SingleRate { get; init; }
    public decimal MultiRate { get; init; }
    public RoomDisplayStatus DisplayStatus { get; init; }
    public bool HasActiveSession { get; init; }
    public SessionPreviewViewModel? SessionPreview { get; init; }
    public bool IsAlreadyMember { get; init; }
}

// LEGACY(places): LegacyMapping, Place/Stay/Tariff to the old Room/Table/Reservation shapes — remove when every till and customer app is on /api/places and /api/stays.
public static class LegacyMapping
{
    /// <summary>The rate the old two-rate shape shows for an option; zero when the tariff has no such option.</summary>
    public static decimal Rate(this TariffViewModel? tariff, string code)
        => tariff?.Options.FirstOrDefault(o => o.Code == code)?.HourlyRate ?? 0m;

    /// <summary>The old "Single"/"Multi" word: the option's English name.</summary>
    public static string? PlayerModeWord(this TariffViewModel tariff, string? code)
        => code is null ? null : tariff.Options.FirstOrDefault(o => o.Code == code)?.Name.En ?? code;

    public static RoomDisplayStatus ToLegacy(this PlaceDisplayStatus status) => (RoomDisplayStatus)(int)status;

    public static ReservationStatus ToLegacy(this StayStatus status) => (ReservationStatus)(int)status;

    public static RoomViewModel ToRoom(this PlaceViewModel place) => new()
    {
        Id = place.Id,
        Name = place.Name,
        Description = place.Description,
        SingleRate = place.Tariff.Rate(Tariff.SingleCode),
        MultiRate = place.Tariff.Rate(Tariff.MultiCode),
        DisplayStatus = place.Status.ToLegacy(),
    };

    public static TableViewModel ToTable(this PlaceViewModel place) => new()
    {
        // LEGACY(places): the table's public id is the printed sticker's LegacyTableId when it has one — remove when the printed room/table stickers are reprinted with /p/{id}.
        Id = place.LegacyTableId ?? place.Id,
        PlaceId = place.Id,
        Name = place.Name,
        BranchId = place.BranchId,
        IsActive = place.IsActive,
    };

    public static ReservationViewModel ToReservation(this StayViewModel stay)
    {
        StayCostViewModel? Line(string code) => stay.Costs.FirstOrDefault(c => c.OptionCode == code);
        return new ReservationViewModel
        {
            Id = stay.Id,
            RoomId = stay.PlaceId,
            RoomName = stay.PlaceName,
            SingleRate = stay.Tariff.Rate(Tariff.SingleCode),
            MultiRate = stay.Tariff.Rate(Tariff.MultiCode),
            CustomerId = stay.CustomerId,
            CustomerName = stay.CustomerName,
            CreatedAt = stay.CreatedAt,
            ActualStartTime = stay.StartedAt,
            EndTime = stay.EndedAt,
            TotalCost = stay.TotalCost,
            ReceiptNumber = stay.ReceiptNumber,
            PaidAt = stay.PaidAt,
            TicketId = stay.TicketId,
            PaidWith = stay.PaidWith,
            CurrentPlayerMode = stay.Tariff.PlayerModeWord(stay.CurrentOptionCode),
            SingleRoundedHours = Line(Tariff.SingleCode)?.Hours ?? 0m,
            MultiRoundedHours = Line(Tariff.MultiCode)?.Hours ?? 0m,
            SingleCost = Line(Tariff.SingleCode)?.Cost ?? 0m,
            MultiCost = Line(Tariff.MultiCode)?.Cost ?? 0m,
            Status = stay.Status.ToLegacy(),
            Notes = stay.Notes,
            ExpiresAt = stay.ExpiresAt,
            Members = stay.Members.Select(m => new SessionMemberViewModel
            {
                CustomerId = m.CustomerId,
                CustomerName = m.CustomerName,
                JoinedAt = m.JoinedAt,
                Role = m.Role,
            }).ToList(),
            Segments = stay.Segments.Select(s => new SessionSegmentViewModel
            {
                PlayerMode = s.OptionName.En,
                HourlyRate = s.HourlyRate,
                StartTime = s.StartTime,
                EndTime = s.EndTime,
            }).ToList(),
        };
    }

    public static RoomScanViewModel ToRoomScan(this PlaceScanViewModel scan) => new()
    {
        BranchId = scan.BranchId,
        RoomId = scan.PlaceId,
        RoomName = scan.PlaceName,
        SingleRate = scan.Tariff.Rate(Tariff.SingleCode),
        MultiRate = scan.Tariff.Rate(Tariff.MultiCode),
        DisplayStatus = scan.Status.ToLegacy(),
        HasActiveSession = scan.HasRunningStay,
        SessionPreview = scan.Stay is { } stay && scan.HasRunningStay
            ? new SessionPreviewViewModel
            {
                SessionId = stay.StayId,
                RoomId = stay.PlaceId,
                RoomName = stay.PlaceName,
                StartTime = stay.StartTime,
                MemberCount = stay.MemberCount,
            }
            : null,
        IsAlreadyMember = scan.IsAlreadyMember,
    };

    public static SessionStats ToLegacy(this StayStats stats) => new()
    {
        Days = stats.Days.Select(d => new SessionStatsDay { Date = d.Date, Sessions = d.Stays, Hours = d.Hours, Revenue = d.Revenue }).ToList(),
        Rooms = stats.Places.Select(p => new SessionStatsRoom { RoomId = p.PlaceId, RoomName = p.PlaceName, Sessions = p.Stays, Hours = p.Hours, Revenue = p.Revenue }).ToList(),
    };
}
