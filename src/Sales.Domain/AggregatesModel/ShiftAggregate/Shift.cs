#nullable enable
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

/// <summary>
/// Shift aggregate root — one cashier's custody of the drawer: opened with a
/// counted float, fed by cash sales and pay-ins/outs, closed with a counted
/// total. The over/short against the expectation is the whole point: it is
/// computed once at close, from numbers the caller assembled, and frozen.
///
/// A shift never blocks selling — a settle with no open shift simply goes
/// unattributed rather than stopping service (docs/pos-plan.md Q4).
/// </summary>
public class Shift : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public ShiftStatus Status { get; private set; }

    public DateTime OpenedAt { get; private set; }

    public string OpenedBy { get; private set; } = string.Empty;

    /// <summary>Cash counted into the drawer at open.</summary>
    public decimal OpeningFloat { get; private set; }

    public DateTime? ClosedAt { get; private set; }

    public string? ClosedBy { get; private set; }

    /// <summary>Cash counted in the drawer at close.</summary>
    public decimal? ClosingCount { get; private set; }

    /// <summary>
    /// What the drawer should have held at close:
    /// float + cash sales − change given − cash refunds + cash tab payments
    /// + pay-ins − pay-outs. Frozen at close.
    /// </summary>
    public decimal? ExpectedCash { get; private set; }

    /// <summary>Counted minus expected: positive = over, negative = short.</summary>
    public decimal? OverShort { get; private set; }

    private readonly List<CashMovement> _movements = [];
    public IReadOnlyCollection<CashMovement> Movements => _movements.AsReadOnly();

    public decimal GetPayInsTotal() => _movements.Where(m => m.Type == CashMovementType.PayIn).Sum(m => m.Amount);

    public decimal GetPayOutsTotal() => _movements.Where(m => m.Type == CashMovementType.PayOut).Sum(m => m.Amount);

    protected Shift() { }

    public Shift(int branchId, decimal openingFloat, string openedBy)
    {
        if (openingFloat < 0)
            throw new SalesDomainException("The opening float cannot be negative");

        if (string.IsNullOrWhiteSpace(openedBy))
            throw new SalesDomainException("A shift needs the cashier opening it");

        BranchId = branchId;
        Status = ShiftStatus.Open;
        OpeningFloat = openingFloat;
        OpenedAt = DateTime.UtcNow;
        OpenedBy = openedBy;

        // The branch opens for business with the drawer: Branch.API turns
        // the ordering and reservation flags on off this event
        AddDomainEvent(new ShiftOpenedDomainEvent(this));
    }

    public void AddMovement(CashMovementType type, decimal amount, string reason, string recordedBy)
    {
        EnsureOpen();

        _movements.Add(new CashMovement(type, amount, reason, recordedBy));
    }

    /// <summary>
    /// Count the drawer and freeze the shift. The cash-sales and change
    /// figures come from the tickets stamped with this shift — the caller
    /// aggregates them; the shift owns the arithmetic and the verdict.
    /// </summary>
    public void Close(decimal closingCount, decimal cashPayments, decimal changeGiven, string closedBy, decimal cashRefunds = 0, decimal cashTabPayments = 0)
    {
        EnsureOpen();

        if (closingCount < 0)
            throw new SalesDomainException("The closing count cannot be negative");

        if (string.IsNullOrWhiteSpace(closedBy))
            throw new SalesDomainException("A shift needs the cashier closing it");

        // Cash refunds left the drawer the way change did; cash taken
        // against a tab went in the way a sale did
        ExpectedCash = OpeningFloat + cashPayments - changeGiven - cashRefunds + cashTabPayments + GetPayInsTotal() - GetPayOutsTotal();
        ClosingCount = closingCount;
        OverShort = closingCount - ExpectedCash;
        ClosedBy = closedBy;
        ClosedAt = DateTime.UtcNow;
        Status = ShiftStatus.Closed;

        // ...and closes with it: both flags go off again
        AddDomainEvent(new ShiftClosedDomainEvent(this));
    }

    private void EnsureOpen()
    {
        if (Status != ShiftStatus.Open)
            throw new SalesDomainException($"Shift {Id} is closed and cannot change.");
    }
}
