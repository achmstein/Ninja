using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

namespace Ninja.Spaces.Domain.Events;

/// <summary>The clock started, as a walk-in or from a seated reservation.</summary>
public record class StayStartedDomainEvent(Stay Stay) : INotification;

/// <summary>The clock stopped; the cost is known.</summary>
public record class StayEndedDomainEvent(Stay Stay) : INotification;

/// <summary>A running stay was cut short; nothing is billed.</summary>
public record class StayCancelledDomainEvent(Stay Stay) : INotification;

/// <summary>Someone joined the party (scan, or named by the till).</summary>
public record class StayMemberJoinedDomainEvent(Stay Stay, string MemberUserId) : INotification;

/// <summary>A walk-in got its owner.</summary>
public record class StayCustomerAssignedDomainEvent(Stay Stay, string CustomerId) : INotification;

/// <summary>A place was created or its details, tariff or active flag changed: what other services project.</summary>
public record class PlaceChangedDomainEvent(Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate.Place Place) : INotification;

/// <summary>The till paid the bill this stay's time was on; the party gets told.</summary>
public record class StayPaidDomainEvent(Stay Stay, int ReceiptNumber, int BranchId) : INotification;

/// <summary>A place was deleted: what other services drop from their projections.</summary>
public record class PlaceDeletedDomainEvent(Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate.Place Place) : INotification;
