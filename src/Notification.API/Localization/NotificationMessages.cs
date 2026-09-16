using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.Localization;

/// <summary>
/// Localized notification messages for FCM notifications.
/// Arabic translations use Egyptian dialect.
/// </summary>
public static class NotificationMessages
{
    // Room Available
    public static readonly LocalizedText RoomAvailableTitle = new("Room Available!", "أوضة فاضية!");
    public static LocalizedText RoomAvailableBody(LocalizedText roomName, string lang) =>
        new($"{roomName.GetText("en")} is now available. Book now!",
            $"{roomName.GetText("ar")} فاضية دلوقتي. احجز دلوقتي!");

    // New Reservation
    public static readonly LocalizedText NewReservationTitle = new("New Reservation!", "حجز جديد!");
    public static LocalizedText NewReservationBody(string customerName, LocalizedText roomName, string lang) =>
        new($"{customerName} reserved {roomName.GetText("en")}",
            $"{customerName} حجز {roomName.GetText("ar")}");

    // New Order
    public static readonly LocalizedText NewOrderTitle = new("New Order!", "أوردر جديد!");
    public static LocalizedText NewOrderBody(int orderId, string buyerName) =>
        new($"Order #{orderId} from {buyerName}",
            $"أوردر #{orderId} من {buyerName}");

    // Service Requests
    public static readonly LocalizedText WaiterNeededTitle = new("Waiter Needed", "محتاج ويتر");
    public static LocalizedText WaiterNeededBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} is calling for a waiter",
            $"{roomName.GetText("ar")} - {userName} عايز ويتر");

    public static readonly LocalizedText ControllerRequestTitle = new("Controller Request", "عايز دراع تاني");
    public static LocalizedText ControllerRequestBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} needs a different controller",
            $"{roomName.GetText("ar")} - {userName} عايز دراع تاني");

    public static readonly LocalizedText BillRequestedTitle = new("Bill Requested", "عايز الشيك");
    public static LocalizedText BillRequestedBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} wants to pay",
            $"{roomName.GetText("ar")} - {userName} عايز يدفع");

    public static readonly LocalizedText SwitchToMultiTitle = new("Switch to Multi", "عايز مالتي");
    public static LocalizedText SwitchToMultiBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} wants to switch to multi",
            $"{roomName.GetText("ar")} - {userName} عايز يحول مالتي");

    public static readonly LocalizedText SwitchToSingleTitle = new("Switch to Single", "عايز سنجل");
    public static LocalizedText SwitchToSingleBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} wants to switch to single",
            $"{roomName.GetText("ar")} - {userName} عايز يحول سنجل");

    public static readonly LocalizedText ChangeOptionTitle = new("Rate Change", "عايز يغير التعريفة");
    public static LocalizedText ChangeOptionBody(LocalizedText roomName, string userName, string option) =>
        new($"{roomName.GetText("en")} - {userName} wants to switch to {option}",
            $"{roomName.GetText("ar")} - {userName} عايز يحول {option}");

    public static readonly LocalizedText ServiceRequestTitle = new("Service Request", "محتاج مساعدة");
    public static LocalizedText ServiceRequestBody(LocalizedText roomName, string userName) =>
        new($"{roomName.GetText("en")} - {userName} needs assistance",
            $"{roomName.GetText("ar")} - {userName} محتاج مساعدة");

    // Order Confirmed (to customer)
    public static readonly LocalizedText OrderConfirmedTitle = new("Order Confirmed", "الأوردر اتأكد");
    public static LocalizedText OrderConfirmedBody(int orderId) =>
        new($"Your order #{orderId} has been confirmed",
            $"الأوردر بتاعك #{orderId} اتأكد");

    // Order Cancelled (to customer)
    public static readonly LocalizedText OrderCancelledTitle = new("Order Cancelled", "الأوردر اتلغى");
    public static LocalizedText OrderCancelledBody(int orderId) =>
        new($"Your order #{orderId} has been cancelled",
            $"الأوردر بتاعك #{orderId} اتلغى");

    // Reservation Cancelled (admin-facing)
    public static readonly LocalizedText ReservationCancelledTitle = new("Reservation Cancelled", "الحجز اتلغى");
    public static LocalizedText ReservationCancelledBody(string customerName, LocalizedText roomName, string lang) =>
        new($"{customerName} cancelled {roomName.GetText("en")}",
            $"{customerName} لغى حجز {roomName.GetText("ar")}");

    // Reservation Cancelled (customer-facing)
    public static readonly LocalizedText YourReservationCancelledTitle = new("Reservation Cancelled", "حجزك اتلغى");
    public static LocalizedText YourReservationCancelledBody(LocalizedText roomName, string lang) =>
        new($"Your reservation for {roomName.GetText("en")} has been cancelled",
            $"حجزك في {roomName.GetText("ar")} اتلغى");

    // Order Reminders (escalating urgency for admins)
    public static LocalizedText OrderReminderTitle(int reminderCount) => reminderCount switch
    {
        <= 1 => new("New order pending", "أوردر جديد مستني"),
        2 => new("Order still pending", "الأوردر لسه مستني"),
        3 => new("Order needs attention", "الأوردر محتاج تأكيد"),
        _ => new("Order not confirmed", "الأوردر ماتأكدش")
    };

    public static LocalizedText OrderReminderBody(int orderId, string buyerName, int minutesPending) =>
        new($"Order #{orderId} from {buyerName} has been waiting {minutesPending} min",
            $"أوردر #{orderId} من {buyerName} مستني من {minutesPending} دقيقة");
}
