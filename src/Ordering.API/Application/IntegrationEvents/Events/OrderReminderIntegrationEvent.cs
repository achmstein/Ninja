namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event sent when a pending order has not been confirmed
/// and needs a reminder notification to admins.
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
