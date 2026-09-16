using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;

namespace Chillax.Spaces.Domain.Events;

/// <summary>A customer asked for a place; the hold clock is ticking.</summary>
public record class StayHeldDomainEvent(Stay Stay) : INotification;

/// <summary>The clock started, from a hold or as a walk-in.</summary>
public record class StayStartedDomainEvent(Stay Stay) : INotification;

/// <summary>The clock stopped; the cost is known.</summary>
public record class StayEndedDomainEvent(Stay Stay) : INotification;

/// <summary>Given up or cut short. PreviousStatus says whether a clock was running.</summary>
public record class StayCancelledDomainEvent(Stay Stay, StayStatus PreviousStatus) : INotification;

/// <summary>Someone joined the party (scan, or named by the till).</summary>
public record class StayMemberJoinedDomainEvent(Stay Stay, string MemberUserId) : INotification;

/// <summary>A walk-in got its owner.</summary>
public record class StayCustomerAssignedDomainEvent(Stay Stay, string CustomerId) : INotification;

/// <summary>A place was created or its details, tariff or active flag changed: what other services project.</summary>
public record class PlaceChangedDomainEvent(Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate.Place Place) : INotification;
