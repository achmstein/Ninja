using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.Domain.Events;

public record ShiftOpenedDomainEvent(Shift Shift) : INotification;
