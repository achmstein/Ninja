using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.Domain.Events;

/// <summary>A wage or an advance left the drawer for a named employee.</summary>
public record CashPaidOutToStaffDomainEvent(Shift Shift, CashMovement Movement) : INotification;
