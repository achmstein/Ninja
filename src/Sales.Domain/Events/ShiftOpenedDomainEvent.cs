using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.Domain.Events;

public record ShiftOpenedDomainEvent(Shift Shift) : INotification;
