using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the authoritative session cost breakdown Spaces publishes
/// when a session ends. Sales turns it into the ticket's time lines — the one
/// place session rounding ever lands, exactly once.
/// </summary>
public record SessionCompletedIntegrationEvent(
    int ReservationId,
    string? CustomerId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    decimal TotalCost,
    DateTime StartTime,
    DateTime EndTime,
    TimeSpan Duration,
    /// <summary>One line per rate option of the stay's tariff: the lines the bill prints.</summary>
    List<SessionCostLine> Costs,
    int BranchId = 0) : IntegrationEvent;

/// <summary>What one rate option of a stay cost: the line the bill prints.</summary>
public record SessionCostLine(
    string OptionCode,
    LocalizedText OptionName,
    decimal HourlyRate,
    decimal Hours,
    decimal Cost);
