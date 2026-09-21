using Ninja.EventBus.Events;
using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.API.Application.IntegrationEvents.Events;

// Spaces' events keep their names from before the Places remodel: the
// routing key is the type name, and every consumer keeps its own copy.

/// <summary>A place was created or its details, tariff or active flag changed — or it was deleted. The projection other services keep.</summary>
public record PlaceUpdatedIntegrationEvent(
    int PlaceId,
    string Kind,
    LocalizedText Name,
    int BranchId,
    bool IsTimed,
    bool HasOptions,
    bool IsActive,
    bool Deleted = false) : IntegrationEvent;

/// <summary>A customer holds a place; staff see it and the hold's expiry.</summary>
public record PlaceReservedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ExpiresAt,
    int BranchId = 1,
    bool StartOnConfirm = false) : IntegrationEvent;

/// <summary>The clock started (from a hold or as a walk-in); OptionCode is the rate option it runs on.</summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    DateTime? ActualStartTime,
    string? OptionCode,
    int BranchId = 0) : IntegrationEvent;

/// <summary>The clock stopped; the party's devices drop their stay notification.</summary>
public record SessionEndedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    List<string> MemberUserIds) : IntegrationEvent;

/// <summary>A place is free again: whoever asked to be told, is told.</summary>
public record PlaceBecameAvailableIntegrationEvent(
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    int BranchId = 1) : IntegrationEvent;

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
/// in. Costs is the per-option breakdown every tariff has; TotalCost its sum.
/// </summary>
public record SessionCompletedIntegrationEvent(
    int ReservationId,
    string? CustomerId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    List<SessionCostLine> Costs,
    decimal TotalCost,
    DateTime StartTime,
    DateTime EndTime,
    TimeSpan Duration,
    int BranchId = 0) : IntegrationEvent;

/// <summary>Someone joined the party; their phone gets the stay notification.</summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string MemberUserId,
    DateTime? ActualStartTime,
    string? OptionCode) : IntegrationEvent;

/// <summary>A walk-in got its owner; every screen showing the place has a name to put on it.</summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0) : IntegrationEvent;

/// <summary>A hold was given up or a running stay cut short; nothing is billed.</summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1,
    bool WasRunning = false) : IntegrationEvent;

/// <summary>
/// The bill a stay's time was on was paid. Carries the party, so
/// Notification can nudge each one's screens to refetch their stays. No
/// money travels; the stay itself says what changed.
/// </summary>
public record SessionPaidIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId) : IntegrationEvent;
