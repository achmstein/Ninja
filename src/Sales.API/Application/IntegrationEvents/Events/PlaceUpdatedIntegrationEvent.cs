#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a place is created, changed or deleted, and
/// for every place at its start (services share no contracts assembly — each declares the fields
/// it reads). Sales keeps what each place is called off it.
/// </summary>
public record PlaceUpdatedIntegrationEvent(
    int PlaceId,
    string Kind,
    LocalizedText Name,
    int BranchId,
    bool Deleted = false) : IntegrationEvent;
