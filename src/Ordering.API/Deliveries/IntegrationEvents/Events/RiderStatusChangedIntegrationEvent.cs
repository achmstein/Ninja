namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// A rider went on duty or off at a branch, as their app said. Published only
/// when it changes (not on every beat), so the till's list of riders moves
/// the moment a rider starts or stops, rather than on its next poll.
/// </summary>
public record RiderStatusChangedIntegrationEvent(string UserId, int BranchId, bool OnDuty) : IntegrationEvent;
