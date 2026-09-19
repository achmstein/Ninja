using System.Globalization;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.Localization;

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

    // The day's digest, pushed when the till closes its shift
    public static readonly LocalizedText ShiftClosedTitle = new("Shift closed", "الوردية قفلت");

    /// <summary>
    /// Four short lines: sales and bills, the tender split, the drawer, and
    /// what left as discounts, refunds and tab payments (only the parts that
    /// are not zero). Numbers in Western digits on both sides, as every
    /// screen prints them.
    /// </summary>
    public static LocalizedText ShiftClosedBody(ShiftClosedIntegrationEvent shift) =>
        new(Digest(shift, "en"), Digest(shift, "ar"));

    private static string Digest(ShiftClosedIntegrationEvent shift, string lang)
    {
        var ar = lang == "ar";
        var lines = new List<string>
        {
            ar ? $"المبيعات {Money(shift.SalesTotal)} · {shift.TicketsSettled} حساب"
               : $"Sales {Money(shift.SalesTotal)} · {shift.TicketsSettled} bills",
        };

        var tenders = (shift.TenderTotals ?? [])
            .Where(t => t.Amount != 0)
            .Select(t => $"{Tender(t.Tender, ar)} {Money(t.Amount)}")
            .ToList();
        if (tenders.Count > 0)
            lines.Add(string.Join(" · ", tenders));

        lines.Add(shift.OverShort switch
        {
            > 0 => ar ? $"الدرج زيادة {Money(shift.OverShort)}" : $"Drawer over {Money(shift.OverShort)}",
            < 0 => ar ? $"الدرج ناقص {Money(-shift.OverShort)}" : $"Drawer short {Money(-shift.OverShort)}",
            _ => ar ? "الدرج مظبوط" : "Drawer exact",
        });

        var left = new List<string>();
        if (shift.Discounts != 0) left.Add(ar ? $"خصومات {Money(shift.Discounts)}" : $"Discounts {Money(shift.Discounts)}");
        if (shift.RefundsTotal != 0) left.Add(ar ? $"مرتجعات {Money(shift.RefundsTotal)}" : $"Refunds {Money(shift.RefundsTotal)}");
        if (shift.TabPaymentsTotal != 0) left.Add(ar ? $"مدفوعات الحساب {Money(shift.TabPaymentsTotal)}" : $"Tab payments {Money(shift.TabPaymentsTotal)}");
        if (shift.PayOutsTotal != 0) left.Add(ar ? $"مصاريف {Money(shift.PayOutsTotal)}" : $"Pay-outs {Money(shift.PayOutsTotal)}");
        if (left.Count > 0)
            lines.Add(string.Join(" · ", left));

        return string.Join("\n", lines);
    }

    private static string Money(decimal amount) => amount.ToString("#,##0.##", CultureInfo.InvariantCulture);

    private static string Tender(string tender, bool ar) => tender switch
    {
        "Cash" => ar ? "كاش" : "Cash",
        "Card" => ar ? "فيزا" : "Card",
        "InstaPay" => ar ? "انستاباي" : "InstaPay",
        "Account" => ar ? "على الحساب" : "On account",
        _ => tender,
    };
}
