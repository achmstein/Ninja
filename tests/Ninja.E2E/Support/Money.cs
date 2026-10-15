namespace Ninja.E2E.Support;

/// <summary>
/// Pure mirrors of the domain arithmetic, so expected values are computed
/// from inputs rather than typed in. Each method names the code it mirrors.
/// </summary>
public static class Money
{
    public static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>A ticket's bill under the branch pricing rules (Sales Ticket.ComputeBill).</summary>
    /// <param name="subtotal">Menu money of all lines.</param>
    /// <param name="served">Lines that earn service charge: order lines on Table/Room tickets; 0 for a Counter ticket; room time never.</param>
    public static Bill Bill(decimal subtotal, decimal served, decimal vatRate, decimal serviceRate, bool pricesIncludeVat = false)
    {
        var service = Round(Math.Max(0m, served) * serviceRate);
        var taxable = subtotal + service;
        var vat = pricesIncludeVat ? Round(taxable - taxable / (1 + vatRate)) : Round(taxable * vatRate);
        var total = pricesIncludeVat ? taxable : taxable + vat;
        return new Bill(subtotal, service, vat, total);
    }

    /// <summary>
    /// What refunding part of one line gives back (Sales Refund.Issue): menu amount scaled by what was paid per
    /// pound of the items. Sales divides the total by the positive item lines (loyalty, promo and the delivery fee
    /// apart); this takes the subtotal, which is the same thing on a bill with none of those, as the scenarios ring up.
    /// </summary>
    public static decimal RefundLine(decimal lineTotal, decimal lineQty, decimal refundQty, decimal ticketTotal, decimal ticketSubtotal)
    {
        var menuAmount = Round(lineTotal * refundQty / lineQty);
        var paidPerMenuPound = ticketSubtotal > 0 ? ticketTotal / ticketSubtotal : 1m;
        return Round(menuAmount * paidPerMenuPound);
    }

    /// <summary>Points an order earns (Loyalty OrderStatusChangedToConfirmedIntegrationEventHandler.PointsToAward).</summary>
    public static int LoyaltyPoints(decimal orderTotal, string tier)
        => (int)Math.Floor(orderTotal * 2 * (decimal)TierMultiplier(tier));

    /// <summary>Points clawed back on a refund or void (Loyalty OrderPointsClawback).</summary>
    public static int Clawback(int earned, decimal refundedMenuAmount, decimal orderMenuAmount)
    {
        var share = Math.Min(1m, refundedMenuAmount / orderMenuAmount);
        return (int)Math.Round(earned * share, MidpointRounding.AwayFromZero);
    }

    private static double TierMultiplier(string tier) => tier switch
    {
        "Silver" => 1.25,
        "Gold" => 1.5,
        "Platinum" => 2.0,
        _ => 1.0,
    };

    /// <summary>
    /// Payroll's business day: Cairo local time with a 06:00 cutoff (Payroll.Domain BusinessDay.Of).
    /// Finance dates by the branch's own day start, 05:00 for the seeded branches, which only
    /// buckets differently between five and six on the morning of a month's first day.
    /// </summary>
    public static DateOnly BusinessDay(DateTime utc)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Cairo.Value);
        var day = DateOnly.FromDateTime(local);
        return local.Hour < 6 ? day.AddDays(-1) : day;
    }

    public static DateOnly BusinessDayNow() => BusinessDay(DateTime.UtcNow);

    /// <summary>The calendar month a business day falls in, as Finance and Payroll bucket it.</summary>
    public static (int Year, int Month, DateOnly Start, DateOnly End) Month(DateOnly day)
    {
        var start = new DateOnly(day.Year, day.Month, 1);
        return (day.Year, day.Month, start, start.AddMonths(1).AddDays(-1));
    }

    private static readonly Lazy<TimeZoneInfo> Cairo = new(() =>
    {
        foreach (var id in new[] { "Africa/Cairo", "Egypt Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    });
}

public sealed record Bill(decimal Subtotal, decimal ServiceCharge, decimal Vat, decimal Total);
