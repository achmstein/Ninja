using System.Text.Json.Serialization;

namespace Chillax.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Where a confirmed order stands in the kitchen. A sub-state of
/// <see cref="OrderStatus.Confirmed"/>, not a status of its own: confirmation
/// is what bills the order and awards points, and none of that moves while
/// the barista works. Customers are never shown it — it drives the kitchen
/// display and nothing else.
/// NotStarted -> Preparing -> Ready, with Ready reachable straight from
/// NotStarted and Ready -> Preparing as the recall.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PreparationStatus
{
    NotStarted = 0,
    Preparing = 1,
    Ready = 2
}
