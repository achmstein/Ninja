namespace Ninja.Ordering.API.Application.Commands;

/// <param name="PlatformReason">
/// For a delivery platform's order: why it is turned down, in the platform's
/// words (TOO_BUSY, ITEM_UNAVAILABLE, …); left out, the kitchen is too busy.
/// Ignored on every other order.
/// </param>
public record CancelOrderCommand(int OrderNumber, string PlatformReason = null) : IRequest<bool>;
