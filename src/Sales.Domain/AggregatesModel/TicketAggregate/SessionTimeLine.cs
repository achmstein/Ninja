#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// What one rate option of a stay cost, as Spaces settled it: the line the
/// bill prints. Hours are already rounded; Cost is the money for them.
/// </summary>
public record SessionTimeLine(LocalizedText OptionName, decimal Hours, decimal Cost);
