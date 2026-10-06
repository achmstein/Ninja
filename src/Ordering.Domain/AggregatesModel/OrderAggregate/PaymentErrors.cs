#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// The names of the rules an order paid ahead online can break, as the API
/// answers them and the apps translate them. Stable: an app keys its words on these.
/// </summary>
public static class PaymentErrors
{
    /// <summary>The business does not take payment ahead (the owner's switch is off).</summary>
    public const string AheadOff = "payment.ahead_off";

    /// <summary>Paying ahead is for a delivery or an order the customer collects, placed from the apps; a table's or a room's order is paid on its bill.</summary>
    public const string NotAhead = "payment.not_ahead";

    /// <summary>The order is not waiting for its payment (still being checked, already paid, or cancelled).</summary>
    public const string NotDue = "payment.not_due";

    /// <summary>The payment came after the order stopped waiting for it (cancelled unpaid): it is given back.</summary>
    public const string TooLate = "payment.too_late";

    /// <summary>A second payment for an order already paid: it is given back.</summary>
    public const string PaidAlready = "payment.paid_already";

    /// <summary>The payment is not for what the order comes to: it is given back.</summary>
    public const string AmountMismatch = "payment.amount_mismatch";

    /// <summary>The rules an order breaks by where it stands, not by what was sent: answered 409.</summary>
    public static readonly IReadOnlySet<string> StateConflicts = new HashSet<string> { NotDue, TooLate, PaidAlready };
}
