using System.Text.Json.Serialization;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Order status for cafe orders.
/// AwaitingValidation -> Submitted (stock confirmed) -> Confirmed (admin action) or Cancelled
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderStatus
{
    AwaitingValidation = 1,
    Submitted = 2,
    Confirmed = 3,
    Cancelled = 4
}
