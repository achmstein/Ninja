using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>
/// Raised when a customer joins an active session (via code or admin assignment)
/// </summary>
public record class SessionMemberJoinedDomainEvent(
    Reservation Reservation,
    string MemberUserId) : INotification;
