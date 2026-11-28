#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>A line of an open bill, and how many of it the till asks to cancel.</summary>
public record LineCancel(int LineId, decimal Qty);

/// <summary>What a cancel took off one line: how many, and the menu money that went with them.</summary>
public record CancelledLine(TicketLine Line, decimal Qty, decimal Amount);
