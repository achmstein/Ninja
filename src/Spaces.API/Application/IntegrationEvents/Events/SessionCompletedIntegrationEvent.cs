using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

public record SessionCompletedIntegrationEvent(
    int ReservationId,
    string CustomerId,
    int RoomId,
    LocalizedText RoomName,
    decimal SingleCost,
    decimal MultiCost,
    decimal TotalCost,
    decimal SingleDuration,
    decimal MultiDuration,
    DateTime StartTime,
    DateTime EndTime,
    TimeSpan Duration) : IntegrationEvent;
