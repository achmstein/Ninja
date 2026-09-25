using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>A guest's share came in through the provider: the till hears of it, and a bill it completes settles itself.</summary>
public record OnlinePaymentPaidDomainEvent(OnlinePayment Payment) : INotification;
