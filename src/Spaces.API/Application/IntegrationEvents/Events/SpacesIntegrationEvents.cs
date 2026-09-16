using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

// ---------------------------------------------------------------------------
// Spaces' events keep their names and positions from before the Places
// remodel (the routing key is the type name; consumers are positional
// records). Each gains PlaceId / PlaceKind / PlaceName with defaults, and
// the old RoomId / RoomName keep carrying the place id and name for one
// release, until every consumer reads the new fields.
// ---------------------------------------------------------------------------

/// <summary>A place was created or its details, tariff or active flag changed — or it was deleted. The projection other services keep.</summary>
public record PlaceUpdatedIntegrationEvent(
    int PlaceId,
    string Kind,
    LocalizedText Name,
    int BranchId,
    bool IsTimed,
    bool HasOptions,
    bool IsActive,
    int? LegacyRoomId = null,
    int? LegacyTableId = null,
    bool Deleted = false) : IntegrationEvent;

/// <summary>A customer holds a place; staff see it and the hold's expiry.</summary>
public record RoomReservedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ExpiresAt,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    bool StartOnConfirm = false) : IntegrationEvent;

/// <summary>The clock started (from a hold or as a walk-in). PlayerMode carries the option's English name; OptionCode its code.</summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    DateTime? ActualStartTime,
    string? PlayerMode,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    string? OptionCode = null) : IntegrationEvent;

/// <summary>The clock stopped; the party's devices drop their stay notification.</summary>
public record SessionEndedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    List<string> MemberUserIds,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;

/// <summary>A place is free again: whoever asked to be told, is told.</summary>
public record RoomBecameAvailableIntegrationEvent(
    int RoomId,
    LocalizedText RoomName,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;

/// <summary>What one rate option of a stay cost: the line Sales prints.</summary>
public record SessionCostLine(
    string OptionCode,
    LocalizedText OptionName,
    decimal HourlyRate,
    decimal Hours,
    decimal Cost);

/// <summary>
/// The authoritative cost of a finished stay. Published for every stay with
/// real start and end times — including walk-ins nobody claimed, which is
/// why CustomerId is nullable: the bill exists whether or not anyone signed
/// in. Single/Multi figures stay filled from the options of those codes for
/// one release; Costs is the per-option breakdown every tariff has.
/// </summary>
public record SessionCompletedIntegrationEvent(
    int ReservationId,
    string? CustomerId,
    int RoomId,
    LocalizedText RoomName,
    decimal SingleCost,
    decimal MultiCost,
    decimal TotalCost,
    decimal SingleDuration,
    decimal MultiDuration,
    DateTime StartTime,
    DateTime EndTime,
    TimeSpan Duration,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    List<SessionCostLine>? Costs = null) : IntegrationEvent;

/// <summary>Someone joined the party; their phone gets the stay notification.</summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string MemberUserId,
    DateTime? ActualStartTime,
    string? PlayerMode,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    string? OptionCode = null) : IntegrationEvent;

/// <summary>A walk-in got its owner; every screen showing the place has a name to put on it.</summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int RoomId,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;

/// <summary>A hold was given up or a running stay cut short; nothing is billed.</summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    bool WasRunning = false) : IntegrationEvent;

/// <summary>
/// The bill a stay's time was on was paid. Carries the party, so
/// Notification can nudge each one's screens to refetch their stays. No
/// money travels; the stay itself says what changed.
/// </summary>
public record SessionPaidIntegrationEvent(
    int ReservationId,
    int RoomId,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
