#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// The numbered, frozen record of a settled ticket. Reprinting rereads it;
/// nothing about it ever changes. Numbers run per branch, gap-free enough for
/// a café: they come from a counter row locked inside the settle transaction.
/// </summary>
public class Receipt : Entity, IAggregateRoot
{
    /// <summary>Per-branch sequential receipt number.</summary>
    public int Number { get; private set; }

    public int BranchId { get; private set; }

    public int TicketId { get; private set; }

    public DateTime IssuedAt { get; private set; }

    protected Receipt() { }

    public Receipt(int number, int branchId, int ticketId)
    {
        if (number <= 0)
            throw new SalesDomainException("A receipt needs a positive number");

        Number = number;
        BranchId = branchId;
        TicketId = ticketId;
        IssuedAt = DateTime.UtcNow;
    }
}
