using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.Domain.Events;

public record ShiftClosedDomainEvent(Shift Shift) : INotification;
