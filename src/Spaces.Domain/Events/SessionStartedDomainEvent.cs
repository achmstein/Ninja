using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when admin starts a session (customer begins playing)
/// </summary>
public record class SessionStartedDomainEvent(Reservation Reservation) : INotification;
