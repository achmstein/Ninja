#nullable enable
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;

/// <summary>
/// Money the till took for part of a bill that stays open: one of a group
/// paying for what they had, or an amount on account of the bill. Cash goes
/// into the drawer of the shift that took it, then and there; the sale is
/// still counted when the bill closes, where each part payment becomes a
/// <see cref="Payment"/> on the receipt (marked with its id, so the settling
/// shift's drawer does not count the cash again).
///
/// Given back while the bill is still open (<see cref="Return"/>): the row
/// stays, for the drawer of the shift the cash left.
/// </summary>
public class PartPayment : Entity, IAggregateRoot
{
    public const int PayerNameLength = 200;

    public int TicketId { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>
    /// The shift whose drawer took it; null when none was open (a missing
    /// shift never blocks taking money, the same rule as settling).
    /// </summary>
    public int? ShiftId { get; private set; }

    /// <summary>Cash, Card or InstaPay: money the till itself takes.</summary>
    public PaymentTender Tender { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>Who paid, as the till knew them ("Mona Ali").</summary>
    public string? PayerName { get; private set; }

    /// <summary>The ticket lines it pays for; empty for an amount on account of the bill.</summary>
    public List<int> LineIds { get; private set; } = [];

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    public DateTime? ReturnedAt { get; private set; }

    public string? ReturnedBy { get; private set; }

    /// <summary>The shift whose drawer the money left when it was given back.</summary>
    public int? ReturnedShiftId { get; private set; }

    /// <summary>Still counted towards the bill: not given back.</summary>
    public bool IsActive => ReturnedAt is null;

    /// <summary>The tenders a part payment may be taken in.</summary>
    public static bool IsAllowed(PaymentTender tender) => tender is PaymentTender.Cash or PaymentTender.Card or PaymentTender.InstaPay;

    protected PartPayment() { }

    public static PartPayment Take(
        int ticketId,
        int branchId,
        int? shiftId,
        PaymentTender tender,
        decimal amount,
        string? payerName,
        IEnumerable<int>? lineIds,
        string recordedBy,
        DateTime? recordedAt = null)
    {
        if (!IsAllowed(tender))
            throw new SalesDomainException("A part payment is taken in cash, by card or by InstaPay.");

        if (amount <= 0)
            throw new SalesDomainException("A part payment must be a positive amount.");

        if (string.IsNullOrWhiteSpace(recordedBy))
            throw new SalesDomainException("A part payment needs the cashier taking it.");

        var name = string.IsNullOrWhiteSpace(payerName) ? null : payerName.Trim();
        if (name is { Length: > PayerNameLength })
            throw new SalesDomainException($"The payer's name is at most {PayerNameLength} characters.");

        return new PartPayment
        {
            TicketId = ticketId,
            BranchId = branchId,
            ShiftId = shiftId,
            Tender = tender,
            Amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero),
            PayerName = name,
            LineIds = [.. (lineIds ?? []).Distinct()],
            RecordedBy = recordedBy,
            RecordedAt = recordedAt ?? DateTime.UtcNow,
        };
    }

    /// <summary>
    /// The money is handed back and the bill owes it again. Once only.
    /// </summary>
    /// <param name="shiftId">The open shift whose drawer it leaves; null when none is open.</param>
    public void Return(string by, int? shiftId, DateTime? at = null)
    {
        if (!IsActive)
            throw new SalesDomainException("That part payment was already given back.");

        if (string.IsNullOrWhiteSpace(by))
            throw new SalesDomainException("Giving a part payment back needs who did it.");

        ReturnedAt = at ?? DateTime.UtcNow;
        ReturnedBy = by;
        ReturnedShiftId = shiftId;
    }
}
