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
    // LEGACY(places): the old room/table ids Spaces still sends so a sticker id can be resolved — remove when the printed room/table stickers are reprinted with /p/{id}.
    int? LegacyRoomId = null,
    int? LegacyTableId = null,
    bool Deleted = false) : IntegrationEvent;
