using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the authoritative session cost breakdown Spaces publishes
/// when a session ends. Sales turns it into the ticket's time lines — the one
/// place session rounding ever lands, exactly once.
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
    /// <summary>One line per rate option of the stay's tariff; null from a publisher older than the Places remodel.</summary>
    List<SessionCostLine>? Costs = null) : IntegrationEvent;

/// <summary>What one rate option of a stay cost: the line the bill prints.</summary>
public record SessionCostLine(
    string OptionCode,
    LocalizedText OptionName,
    decimal HourlyRate,
    decimal Hours,
    decimal Cost);
