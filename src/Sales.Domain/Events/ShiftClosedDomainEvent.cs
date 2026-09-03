using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.Domain.Events;

public record ShiftClosedDomainEvent(Shift Shift) : INotification;
