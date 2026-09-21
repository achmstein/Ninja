using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Ninja.Spaces.Domain.Events;

/// <summary>A party asked for a place: staff are told, and the place is kept for them.</summary>
public record class ReservationRequestedDomainEvent(Reservation Reservation) : INotification;

/// <summary>The party sat down; on a timed place the stay it hands over to raises its own start.</summary>
public record class ReservationSeatedDomainEvent(Reservation Reservation) : INotification;

/// <summary>Given up before anyone was seated. WasHolding says whether the place was being kept at the time.</summary>
public record class ReservationCancelledDomainEvent(Reservation Reservation, bool WasHolding) : INotification;

/// <summary>The party left: a plain table is free again (a timed place's stay says so for itself when it ends).</summary>
public record class ReservationCompletedDomainEvent(Reservation Reservation) : INotification;
