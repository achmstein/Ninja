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
