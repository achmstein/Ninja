using System.Globalization;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.Localization;

/// <summary>
/// Every push the platform sends, in the words the reader expects.
///
/// The back office reads one Arabic, so a staff line is a plain
/// <see cref="LocalizedText"/>. A café chooses the Arabic its customers get,
/// so a customer line is a <see cref="CustomerText"/> and the handler asks it
/// for the one this café speaks.
/// </summary>
public static class NotificationMessages
{
    // -----------------------------------------------------------------
    // To the café: the till, the kitchen, the owner's phone
    // -----------------------------------------------------------------

    public static readonly LocalizedText NewReservationTitle = new("New Reservation!", "حجز جديد!");
    public static LocalizedText NewReservationBody(string customerName, LocalizedText placeName, string lang) =>
        new($"{customerName} reserved {placeName.GetText("en")}",
            $"{customerName} حجز {placeName.GetText("ar")}");

    public static readonly LocalizedText NewOrderTitle = new("New Order!", "طلب جديد!");
    public static LocalizedText NewOrderBody(int orderId, string buyerName) =>
        new($"Order #{orderId} from {buyerName}",
            $"طلب #{orderId} من {buyerName}");

    // Service requests, from a table or a room
    public static readonly LocalizedText WaiterNeededTitle = new("Waiter Needed", "طلب نادل");
    public static LocalizedText WaiterNeededBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} is calling for a waiter",
            $"{placeName.GetText("ar")} - {userName} يطلب نادلًا");

    public static readonly LocalizedText ControllerRequestTitle = new("Controller Request", "طلب ذراع تحكم");
    public static LocalizedText ControllerRequestBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} needs a different controller",
            $"{placeName.GetText("ar")} - {userName} يطلب ذراع تحكم آخر");

    public static readonly LocalizedText BillRequestedTitle = new("Bill Requested", "طلب الفاتورة");
    public static LocalizedText BillRequestedBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} wants to pay",
            $"{placeName.GetText("ar")} - {userName} يريد الدفع");

    public static readonly LocalizedText SwitchToMultiTitle = new("Switch to Multi", "التحويل إلى متعدد");
    public static LocalizedText SwitchToMultiBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} wants to switch to multi",
            $"{placeName.GetText("ar")} - {userName} يريد التحويل إلى متعدد");

    public static readonly LocalizedText SwitchToSingleTitle = new("Switch to Single", "التحويل إلى فردي");
    public static LocalizedText SwitchToSingleBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} wants to switch to single",
            $"{placeName.GetText("ar")} - {userName} يريد التحويل إلى فردي");

    public static readonly LocalizedText ChangeOptionTitle = new("Rate Change", "تغيير التعرفة");
    public static LocalizedText ChangeOptionBody(LocalizedText placeName, string userName, string option) =>
        new($"{placeName.GetText("en")} - {userName} wants to switch to {option}",
            $"{placeName.GetText("ar")} - {userName} يريد التحويل إلى {option}");

    public static readonly LocalizedText ServiceRequestTitle = new("Service Request", "طلب مساعدة");
    public static LocalizedText ServiceRequestBody(LocalizedText placeName, string userName) =>
        new($"{placeName.GetText("en")} - {userName} needs assistance",
            $"{placeName.GetText("ar")} - {userName} يحتاج إلى مساعدة");

    public static readonly LocalizedText ReservationCancelledTitle = new("Reservation Cancelled", "تم إلغاء الحجز");
    public static LocalizedText ReservationCancelledBody(string customerName, LocalizedText placeName, string lang) =>
        new($"{customerName} cancelled {placeName.GetText("en")}",
            $"ألغى {customerName} حجز {placeName.GetText("ar")}");

    /// <summary>Escalating, so a pending order cannot sit unseen.</summary>
    public static LocalizedText OrderReminderTitle(int reminderCount) => reminderCount switch
    {
        <= 1 => new("New order pending", "طلب جديد في الانتظار"),
        2 => new("Order still pending", "الطلب ما زال في الانتظار"),
        3 => new("Order needs attention", "الطلب بحاجة إلى تأكيد"),
        _ => new("Order not confirmed", "لم يتم تأكيد الطلب")
    };

    public static LocalizedText OrderReminderBody(int orderId, string buyerName, int minutesPending) =>
        new($"Order #{orderId} from {buyerName} has been waiting {minutesPending} min",
            $"الطلب #{orderId} من {buyerName} في الانتظار منذ {minutesPending} دقيقة");

    // The day's digest, pushed when the till closes its shift
    public static readonly LocalizedText ShiftClosedTitle = new("Shift closed", "أُغلقت الوردية");

    /// <summary>
    /// Four short lines: sales and bills, the tender split, the drawer, and
    /// what left as discounts, refunds and tab payments (only the parts that
    /// are not zero). Numbers in Western digits on both sides, as every
    /// screen prints them.
    /// </summary>
    public static LocalizedText ShiftClosedBody(ShiftClosedIntegrationEvent shift) =>
        new(Digest(shift, "en"), Digest(shift, "ar"));

    // -----------------------------------------------------------------
    // To the customer: their order, their table, their reservation
    // -----------------------------------------------------------------

    public static readonly CustomerText RoomAvailableTitle =
        new("Room Available!", "أوضة فاضية!", "غرفة متاحة!");
    public static CustomerText RoomAvailableBody(LocalizedText placeName, string lang) =>
        new($"{placeName.GetText("en")} is now available. Book now!",
            $"{placeName.GetText("ar")} فاضية دلوقتي. احجز دلوقتي!",
            $"{placeName.GetText("ar")} متاحة الآن. احجز الآن!");

    public static readonly CustomerText OrderConfirmedTitle =
        new("Order Confirmed", "الأوردر اتأكد", "تم تأكيد الطلب");
    public static CustomerText OrderConfirmedBody(int orderId) =>
        new($"Your order #{orderId} has been confirmed",
            $"الأوردر بتاعك #{orderId} اتأكد",
            $"تم تأكيد طلبك #{orderId}");

    public static readonly CustomerText OrderCancelledTitle =
        new("Order Cancelled", "الأوردر اتلغى", "تم إلغاء الطلب");
    public static CustomerText OrderCancelledBody(int orderId) =>
        new($"Your order #{orderId} has been cancelled",
            $"الأوردر بتاعك #{orderId} اتلغى",
            $"تم إلغاء طلبك #{orderId}");

    public static readonly CustomerText YourReservationCancelledTitle =
        new("Reservation Cancelled", "حجزك اتلغى", "تم إلغاء حجزك");
    public static CustomerText YourReservationCancelledBody(LocalizedText placeName, string lang) =>
        new($"Your reservation for {placeName.GetText("en")} has been cancelled",
            $"حجزك في {placeName.GetText("ar")} اتلغى",
            $"تم إلغاء حجزك في {placeName.GetText("ar")}");

    // -----------------------------------------------------------------

    private static string Digest(ShiftClosedIntegrationEvent shift, string lang)
    {
        var ar = lang == "ar";
        var lines = new List<string>
        {
            ar ? $"المبيعات {Money(shift.SalesTotal)} · {shift.TicketsSettled} فاتورة"
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
            > 0 => ar ? $"زيادة في الدرج {Money(shift.OverShort)}" : $"Drawer over {Money(shift.OverShort)}",
            < 0 => ar ? $"عجز في الدرج {Money(-shift.OverShort)}" : $"Drawer short {Money(-shift.OverShort)}",
            _ => ar ? "الدرج مطابق" : "Drawer exact",
        });

        var left = new List<string>();
        if (shift.Discounts != 0) left.Add(ar ? $"خصومات {Money(shift.Discounts)}" : $"Discounts {Money(shift.Discounts)}");
        if (shift.RefundsTotal != 0) left.Add(ar ? $"مرتجعات {Money(shift.RefundsTotal)}" : $"Refunds {Money(shift.RefundsTotal)}");
        if (shift.TabPaymentsTotal != 0) left.Add(ar ? $"مدفوعات الحساب {Money(shift.TabPaymentsTotal)}" : $"Tab payments {Money(shift.TabPaymentsTotal)}");
        if (shift.PayOutsTotal != 0) left.Add(ar ? $"مصروفات {Money(shift.PayOutsTotal)}" : $"Pay-outs {Money(shift.PayOutsTotal)}");
        if (left.Count > 0)
            lines.Add(string.Join(" · ", left));

        return string.Join("\n", lines);
    }

    private static string Money(decimal amount) => amount.ToString("#,##0.##", CultureInfo.InvariantCulture);

    private static string Tender(string tender, bool ar) => tender switch
    {
        "Cash" => ar ? "نقدًا" : "Cash",
        "Card" => ar ? "بطاقة" : "Card",
        "InstaPay" => ar ? "انستاباي" : "InstaPay",
        "Account" => ar ? "على الحساب" : "On account",
        _ => tender,
    };
}
