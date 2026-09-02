using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// The authoritative cost breakdown of a finished session. Published for every
/// session with real start/end times — including cashier-started walk-ins with
/// no customer attached, which is why <paramref name="CustomerId"/> is nullable:
/// the bill exists whether or not anyone signed in.
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
    int BranchId = 0) : IntegrationEvent;
