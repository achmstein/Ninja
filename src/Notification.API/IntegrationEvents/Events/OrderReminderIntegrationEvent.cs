using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a pending order needs a reminder notification.
/// </summary>
public record OrderReminderIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public string BuyerName { get; }
    public int BranchId { get; }
    public int ReminderCount { get; }
    public int MinutesPending { get; }

    /// <summary>
    /// What the order waits for: staff to confirm it (<see cref="Submitted"/>,
    /// and what an older Ordering means), or the menu check (<see cref="Validating"/>).
    /// </summary>
    public string Stage { get; init; } = Submitted;

    public const string Submitted = "Submitted";
    public const string Validating = "Validating";

    public OrderReminderIntegrationEvent(
        int orderId, string buyerName, int branchId, int reminderCount, int minutesPending)
    {
        OrderId = orderId;
        BuyerName = buyerName;
        BranchId = branchId;
        ReminderCount = reminderCount;
        MinutesPending = minutesPending;
    }
}
