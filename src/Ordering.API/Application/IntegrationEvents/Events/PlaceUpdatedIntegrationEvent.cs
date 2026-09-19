#nullable enable
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a place is created,
/// changed or deleted (services share no contracts assembly — each declares
/// the fields it reads). Ordering keeps a projection off it so a scanned
/// place that was deactivated is refused at order time.
/// </summary>
public record PlaceUpdatedIntegrationEvent(
    int PlaceId,
    string Kind,
    LocalizedText Name,
    int BranchId,
    bool IsTimed,
    bool HasOptions,
    bool IsActive,
    bool Deleted = false) : IntegrationEvent;
