namespace Chillax.Ordering.Domain.Events;

/// <summary>
/// The kitchen moved a confirmed order between NotStarted, Preparing and
/// Ready. Only kitchen screens care, so the integration event this becomes
/// is a pointer: the order, its branch and the new state.
/// </summary>
public record class OrderPreparationChangedDomainEvent(
    int OrderId,
    int BranchId,
    PreparationStatus Preparation) : INotification;
