using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when a customer creates a reservation
/// </summary>
public record class RoomReservedDomainEvent(Reservation Reservation) : INotification;
