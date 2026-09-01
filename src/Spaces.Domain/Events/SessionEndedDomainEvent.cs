using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when admin ends a session (customer stops playing)
/// Used to update room status and potentially trigger billing/loyalty
/// </summary>
public record class SessionEndedDomainEvent(Reservation Reservation) : INotification;
