namespace Ninja.Tenant.API.Model;

public class Branch
{
    public int Id { get; set; }
    public LocalizedText Name { get; set; } = new();
    public LocalizedText? Address { get; set; }
    public string? Phone { get; set; }

    /// <summary>The tax registration number printed on receipts.</summary>
    public string? TaxNumber { get; set; }

    /// <summary>The line under the receipt, in both languages; the till's own thank-you when empty.</summary>
    public LocalizedText? ReceiptFooter { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    /// <summary>
    /// When the branch's day turns over: a day runs from it to the same time the next day, so every sale,
    /// cash movement and report lands in a day, whatever hours the branch keeps (a branch open all night
    /// or all week included). Not its opening hours: set it where nothing is sold, 06:00 by default, as
    /// Finance and Payroll turn their day over.
    /// </summary>
    public TimeOnly DayStartTime { get; set; } = new(6, 0);
    public bool IsOrderingEnabled { get; set; } = true;
    public bool IsReservationsEnabled { get; set; } = true;

    /// <summary>
    /// Ordering to a table needs an account here: a guest may still browse,
    /// but only a signed-in customer can put an order on a table. Off by
    /// default; a branch turns it on when strangers with a table's link
    /// become a problem. Ordering enforces it from its projection.
    /// </summary>
    public bool RequireSignInForTableOrders { get; set; }
}
