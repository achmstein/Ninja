using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.Queries;

/// <summary>
/// Computed display status for UI
/// </summary>
public enum RoomDisplayStatus
{
    Available = 1,      // Can book now
    Occupied = 2,       // Someone is playing
    Reserved = 3,       // Waiting for customer to arrive (15 min window)
    Maintenance = 4     // Out of service
}

public record RoomViewModel
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public LocalizedText? Description { get; init; }
    public decimal SingleRate { get; init; }
    public decimal MultiRate { get; init; }
    public RoomDisplayStatus DisplayStatus { get; init; }
}

public record ReservationViewModel
{
    public int Id { get; init; }
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public decimal SingleRate { get; init; }
    public decimal MultiRate { get; init; }
    /// <summary>
    /// Customer ID - null for walk-in sessions without assigned customer
    /// </summary>
    public string? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ActualStartTime { get; init; }
    public DateTime? EndTime { get; init; }
    public decimal? TotalCost { get; init; }
    /// <summary>The receipt the till settled the time on; null while unpaid.</summary>
    public int? ReceiptNumber { get; init; }
    public DateTime? PaidAt { get; init; }
    /// <summary>The Sales ticket the time was billed on — what the receipt link opens.</summary>
    public int? TicketId { get; init; }
    /// <summary>"Cash", "Card", "InstaPay", "Account" (on the customer's tab) or "Mixed".</summary>
    public string? PaidWith { get; init; }
    public string? CurrentPlayerMode { get; init; }
    public decimal SingleRoundedHours { get; init; }
    public decimal MultiRoundedHours { get; init; }
    public decimal SingleCost { get; init; }
    public decimal MultiCost { get; init; }
    public ReservationStatus Status { get; init; }
    public string? Notes { get; init; }
    /// <summary>
    /// When this reservation expires if not started (only for Reserved status)
    /// </summary>
    public DateTime? ExpiresAt { get; init; }
    public List<SessionMemberViewModel> Members { get; init; } = new();
    public List<SessionSegmentViewModel> Segments { get; init; } = new();
}

/// <summary>
/// Aggregated session statistics for the admin dashboard.
/// </summary>
public record SessionStats
{
    public List<SessionStatsDay> Days { get; init; } = new();
    public List<SessionStatsRoom> Rooms { get; init; } = new();
}

public record SessionStatsDay
{
    /// <summary>Local calendar day (per the caller's tz offset)</summary>
    public DateOnly Date { get; init; }
    public int Sessions { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

public record SessionStatsRoom
{
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public int Sessions { get; init; }
    public decimal Hours { get; init; }
    public decimal Revenue { get; init; }
}

public record SessionMemberViewModel
{
    public string CustomerId { get; init; } = "";
    public string? CustomerName { get; init; }
    public DateTime JoinedAt { get; init; }
    public string Role { get; init; } = "Member";
}

public record SessionSegmentViewModel
{
    public string PlayerMode { get; init; } = "";
    public decimal HourlyRate { get; init; }
    public DateTime StartTime { get; init; }
    public DateTime? EndTime { get; init; }
}

/// <summary>
/// Preview information for a session before joining
/// </summary>
public record SessionPreviewViewModel
{
    public int SessionId { get; init; }
    public int RoomId { get; init; }
    public LocalizedText RoomName { get; init; } = new();
    public DateTime StartTime { get; init; }
    public int MemberCount { get; init; }
}

/// <summary>
/// Room scan result (for QR code scan-to-join)
/// </summary>
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
