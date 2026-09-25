#nullable enable
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

/// <summary>A guest's share as chosen: the amount and what it stands for.</summary>
public sealed record OnlineShare(SplitMode Mode, decimal Amount, IReadOnlyList<int> LineIds, int? Parts = null, int? Of = null);

/// <summary>
/// What a guest may pay of a bill right now, however they split it. The
/// bill's total is what the ticket would settle for; every share already
/// paid or still in checkout is taken off it first, so a share never goes
/// past what is left and a line is never paid twice.
/// </summary>
public static class OnlineShares
{
    /// <summary>The most people an equal split divides by.</summary>
    public const int MaxParts = 50;

    public static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>Paid or held right now.</summary>
    public static decimal Taken(IEnumerable<OnlinePayment> payments, DateTime now)
        => payments.Where(p => p.Holds(now)).Sum(p => p.Amount);

    /// <summary>Paid for good.</summary>
    public static decimal Paid(IEnumerable<OnlinePayment> payments)
        => payments.Where(p => p.Status == OnlinePaymentStatus.Paid).Sum(p => p.Amount);

    /// <summary>What is left to pay online: the total less every share paid or held.</summary>
    public static decimal Remaining(decimal total, IEnumerable<OnlinePayment> payments, DateTime now)
        => Math.Max(0m, Money(total - Taken(payments, now)));

    /// <summary>The lines some share already pays for, or holds while its checkout is open.</summary>
    public static IReadOnlySet<int> ClaimedLines(IEnumerable<OnlinePayment> payments, DateTime now)
        => payments.Where(p => p.Holds(now) && p.Mode == SplitMode.Items).SelectMany(p => p.LineIds).ToHashSet();

    /// <summary>
    /// A line's part of the total: its own money, taken through the same
    /// discount, service and VAT as the whole bill, so the lines' shares add
    /// up to the total (to the piaster).
    /// </summary>
    public static decimal LineShare(TicketLine line, Bill bill)
        => bill.Subtotal <= 0 ? 0m : Money(line.Total * bill.Total / bill.Subtotal);

    public static OnlineShare Full(Bill bill, IEnumerable<OnlinePayment> payments, DateTime now)
    {
        var remaining = Remaining(bill.Total, payments, now);
        if (remaining <= 0) throw new SalesDomainException("This bill is already paid.");
        return new(SplitMode.Full, remaining, []);
    }

    public static OnlineShare Items(Ticket ticket, Bill bill, IReadOnlyCollection<int> lineIds, IEnumerable<OnlinePayment> payments, DateTime now)
    {
        var list = payments.ToList();
        var wanted = lineIds.Distinct().ToList();
        if (wanted.Count == 0) throw new SalesDomainException("Pick at least one item to pay for.");

        var lines = ticket.Lines.Where(l => wanted.Contains(l.Id)).ToList();
        if (lines.Count != wanted.Count) throw new SalesDomainException("Some of those items are not on this bill.");

        var claimed = ClaimedLines(list, now);
        if (wanted.Any(claimed.Contains))
            throw new SalesDomainException("Some of those items are already paid for, or being paid by someone else.");

        var remaining = Remaining(bill.Total, list, now);
        var amount = Math.Min(Money(lines.Sum(l => LineShare(l, bill))), remaining);
        if (amount <= 0) throw new SalesDomainException("There is nothing left to pay for those items.");
        // What is left after the last unpaid items is a few piasters of rounding: it goes with them
        var unclaimed = ticket.Lines.Where(l => !claimed.Contains(l.Id) && !wanted.Contains(l.Id) && l.Total != 0);
        if (!unclaimed.Any()) amount = remaining;
        return new(SplitMode.Items, amount, wanted);
    }

    public static OnlineShare Equal(Bill bill, int parts, int of, IEnumerable<OnlinePayment> payments, DateTime now)
    {
        if (of < 2 || of > MaxParts) throw new SalesDomainException($"Split between 2 and {MaxParts} people.");
        if (parts < 1 || parts > of) throw new SalesDomainException("Pay for at least one person, and no more than are splitting.");
        var remaining = Remaining(bill.Total, payments, now);
        if (remaining <= 0) throw new SalesDomainException("This bill is already paid.");
        // Rounding leaves a piaster or two on the last share; whoever pays it pays it
        var amount = Money(bill.Total * parts / of);
        if (remaining - amount < 0.05m) amount = remaining;
        return new(SplitMode.Equal, Math.Min(amount, remaining), [], parts, of);
    }

    public static OnlineShare Custom(Bill bill, decimal amount, IEnumerable<OnlinePayment> payments, DateTime now)
    {
        amount = Money(amount);
        if (amount <= 0) throw new SalesDomainException("Enter an amount to pay.");
        var remaining = Remaining(bill.Total, payments, now);
        if (amount > remaining) throw new SalesDomainException($"That is more than is left to pay ({remaining:0.00}).");
        return new(SplitMode.Custom, amount, []);
    }

    /// <summary>
    /// The guest's fee on a share when the café passes the provider's fee
    /// on: a percentage of what is charged plus a fixed part, solved so that
    /// what the provider keeps is what the fee covers.
    /// </summary>
    public static decimal GuestFee(decimal amountAndTip, decimal percent, decimal fixedFee)
    {
        if (amountAndTip <= 0 || (percent <= 0 && fixedFee <= 0)) return 0m;
        var rate = percent / 100m;
        if (rate >= 1) throw new SalesDomainException("The fee percentage must be below 100.");
        // charged = amount + fee, and the provider takes charged * rate + fixed
        var charged = (amountAndTip + fixedFee) / (1 - rate);
        return Money(charged - amountAndTip);
    }
}
