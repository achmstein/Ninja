using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>Money moved for a supplier, an expense or a partner: Finance's to account for.</summary>
public record CashMovedDomainEvent(Shift Shift, CashMovement Movement) : INotification;
