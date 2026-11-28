#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Items of an order the till cancelled, as its bill's line described them: the
/// catalog item (null on a line from before it was stamped, when the name
/// stands in), its options as described, and how many.
/// </summary>
public record ItemCancel(int? ProductId, LocalizedText ProductName, LocalizedText? Details, int Units);

/// <summary>What one cancel struck off one of the order's lines.</summary>
public record CancelledOrderItem(
    int ProductId,
    LocalizedText ProductName,
    LocalizedText? CustomizationsDescription,
    int Units,
    IReadOnlyList<int>? OptionIds,
    int? StationId);
