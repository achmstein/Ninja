#nullable enable
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.AggregatesModel.TabPaymentAggregate;

/// <summary>
/// Money a customer hands the till against their tab: cash into the drawer,
/// or card / InstaPay to the terminal. Not a sale — the sale was counted
/// when the bill went on account — so it never touches the ticket figures;
/// it is its own numbered slip, attributed to the drawer shift it landed in,
/// and Accounts lowers the balance owed off the recorded event. Sales keeps
/// no balance: it records what was taken, nothing more.
///
/// Never edited or voided (no Sales document is): a slip made in error is
/// reversed by a manual charge on the ledger, plus a cash pay-out if cash
/// was handed back.
/// </summary>
public class TabPayment : Entity, IAggregateRoot
{
    /// <summary>Per-branch slip number, sequential like receipts and credit notes.</summary>
    public int Number { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>The tab paid down — always a real account holder.</summary>
    public string CustomerId { get; private set; } = string.Empty;

    /// <summary>The customer's name as the till knew it, for the slip and the ledger.</summary>
    public string? CustomerName { get; private set; }

    /// <summary>Cash, Card or InstaPay — never Account: a tab cannot pay itself.</summary>
    public PaymentTender Tender { get; private set; }

    public decimal Amount { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    /// <summary>
    /// The branch's open shift at the time, whatever the tender; null when
    /// none was open — a missing shift never blocks taking money, the same
    /// rule as settling a ticket.
    /// </summary>
    public int? ShiftId { get; private set; }

    protected TabPayment() { }

    public static TabPayment Record(
        int number,
        int branchId,
        string customerId,
        string? customerName,
        PaymentTender tender,
        decimal amount,
        string recordedBy,
        int? shiftId)
    {
        if (number <= 0)
            throw new SalesDomainException("A tab payment needs a positive slip number.");

        if (string.IsNullOrWhiteSpace(customerId))
            throw new SalesDomainException("A tab payment needs the customer whose tab it pays.");

        if (tender == PaymentTender.Account)
            throw new SalesDomainException("A tab cannot be paid with itself — take cash, card or InstaPay.");

        if (amount <= 0)
            throw new SalesDomainException("A tab payment must be a positive amount.");

        if (string.IsNullOrWhiteSpace(recordedBy))
            throw new SalesDomainException("A tab payment needs the cashier taking it.");

        return new TabPayment
        {
            Number = number,
            BranchId = branchId,
            CustomerId = customerId,
            CustomerName = string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim(),
            Tender = tender,
            Amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero),
            RecordedBy = recordedBy,
            RecordedAt = DateTime.UtcNow,
            ShiftId = shiftId,
        };
    }
}
