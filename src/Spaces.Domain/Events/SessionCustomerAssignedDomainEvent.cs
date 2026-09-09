using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when a customer is put on a reserved or running session that had
/// no one named on it — the till attaching a walk-in to an account.
/// </summary>
public record class SessionCustomerAssignedDomainEvent(
    Reservation Reservation,
    string CustomerId) : INotification;
