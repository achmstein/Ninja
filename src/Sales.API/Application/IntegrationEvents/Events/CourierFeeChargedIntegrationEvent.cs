#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A courier company carried a delivery (handed over, or tried and could not) and charges the
/// business this much for it. Finance books it as a cost of the branch's day. Sent once per order.
/// </summary>
/// <param name="At">When it was delivered, or could not be: the day the cost belongs to.</param>
public record CourierFeeChargedIntegrationEvent(
    int OrderId,
    int BranchId,
    int ProviderId,
    string Provider,
    decimal Fee,
    DateTime At) : IntegrationEvent;
