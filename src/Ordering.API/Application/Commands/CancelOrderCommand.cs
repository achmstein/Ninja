namespace Ninja.Ordering.API.Application.Commands;

/// <param name="PlatformReason">
/// For a delivery platform's order: why it is turned down, in the platform's
/// words (TOO_BUSY, ITEM_UNAVAILABLE, …); left out, the kitchen is too busy.
/// Ignored on every other order.
/// </param>
/// <param name="StockDisposition">
/// For a confirmed delivery that came back: what becomes of its food, as the
/// cashier said ("Waste" or "Restock"); left out, it is waste once made.
/// Ignored for an order never confirmed, which took no stock.
/// </param>
public record CancelOrderCommand(int OrderNumber, string PlatformReason = null, StockDisposition? StockDisposition = null) : IRequest<bool>;
