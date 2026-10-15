namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// What a settled bill's customer paid, divided between the delivery fee and
/// the items (<see cref="Ticket.GetPaidShares"/>).
/// </summary>
/// <param name="DeliveryFeeMenu">The fee lines as billed, before the bill-level figures.</param>
/// <param name="DeliveryFeePaid">What the customer paid for the delivery: the fee with its share of the bill discount, service and VAT.</param>
/// <param name="PerItemPound">What the customer paid per pound of an item line's menu money; the rest of the bill.</param>
public readonly record struct PaidShares(decimal DeliveryFeeMenu, decimal DeliveryFeePaid, decimal PerItemPound)
{
    /// <summary>
    /// What was paid for this much of a line's menu money: an item at the
    /// items' rate, the fee at its own, and nothing for a money-off line,
    /// whose effect is already spread over the items.
    /// </summary>
    public decimal PaidFor(TicketLine line, decimal menuAmount)
    {
        if (line.IsDeliveryFee)
            return DeliveryFeeMenu > 0 ? DeliveryFeePaid * menuAmount / DeliveryFeeMenu : 0m;

        return line.Total > 0 ? menuAmount * PerItemPound : 0m;
    }

    /// <summary>What was paid for the whole line.</summary>
    public decimal PaidFor(TicketLine line) => PaidFor(line, line.Total);
}
