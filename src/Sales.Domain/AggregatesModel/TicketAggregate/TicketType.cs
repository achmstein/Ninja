namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// What kind of visit the ticket bills. Decides how it opens and closes:
/// a Room ticket follows the session lifecycle, a Table ticket opens lazily on
/// the table's first order and closes only at settle, a Counter ticket lives
/// for one sale.
/// </summary>
public enum TicketType
{
    Room = 0,
    Table = 1,
    Counter = 2,
}
