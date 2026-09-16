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
    // LEGACY(places): the old RoomId/RoomName, superseded by PlaceId/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    // LEGACY(places): the old two-rate SingleCost/MultiCost, superseded by Costs — remove when every till and customer app is on /api/places and /api/stays.
    decimal SingleCost,
    decimal MultiCost,
    decimal TotalCost,
    // LEGACY(places): the old two-rate SingleDuration/MultiDuration, superseded by Costs — remove when every till and customer app is on /api/places and /api/stays.
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
