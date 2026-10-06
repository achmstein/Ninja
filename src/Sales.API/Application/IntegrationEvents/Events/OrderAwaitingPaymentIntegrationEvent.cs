#nullable enable
using Ninja.EventBus.Events;
namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when an order paid ahead
/// online is priced and waits for the customer's payment. Same type name as
/// the source (the routing key): what to take, from whom, and by when.
/// </summary>
public record OrderAwaitingPaymentIntegrationEvent(
    int OrderId,
    int BranchId,
    decimal Total,
    string? BuyerIdentityGuid,
    string? GuestId,
    string BuyerName,
    string? Phone,
    bool IsDelivery,
    DateTime DueBy) : IntegrationEvent;
