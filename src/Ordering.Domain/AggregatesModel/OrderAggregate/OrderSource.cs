namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Who put the order into the system. Decides which invariants apply at
/// creation (a guest must say where they sit, a counter sale needs neither
/// identity nor destination) and how the order behaves after stock validation
/// (a POS order confirms itself — the cashier keying it in *is* the approval).
/// </summary>
public enum OrderSource
{
    /// <summary>A signed-in customer ordering from the app or web.</summary>
    Customer = 0,

    /// <summary>Someone without an account ordering via a table/room QR.</summary>
    Guest = 1,

    /// <summary>Staff keying a sale in at the counter POS.</summary>
    Pos = 2,
}
