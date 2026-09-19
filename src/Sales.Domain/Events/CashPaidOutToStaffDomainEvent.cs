using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>A wage or an advance left the drawer for a named employee.</summary>
public record CashPaidOutToStaffDomainEvent(Shift Shift, CashMovement Movement) : INotification;
