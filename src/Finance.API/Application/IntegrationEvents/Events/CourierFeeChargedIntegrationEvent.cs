using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when a courier company carried a delivery and charges the business for it: a cost of
/// the branch's day, booked under "Courier fees". Consumer copy of Sales' event.
/// </summary>
/// <param name="At">When it was delivered, or could not be: the day the cost belongs to.</param>
public record CourierFeeChargedIntegrationEvent(
    int OrderId,
    int BranchId,
    int ProviderId,
    string Provider,
    decimal Fee,
    DateTime At) : IntegrationEvent;
