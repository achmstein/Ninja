using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when a reservation is cancelled
/// </summary>
public record class ReservationCancelledDomainEvent(
    Reservation Reservation,
    ReservationStatus PreviousStatus) : INotification;
