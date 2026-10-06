using System.Text.Json.Serialization;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Order status.
/// AwaitingValidation -> Submitted (stock confirmed) -> Confirmed (admin action) or Cancelled.
/// An order paid ahead online waits between the check and the till:
/// AwaitingValidation -> AwaitingPayment -> Submitted (paid), or Cancelled (not paid in time).
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderStatus
{
    AwaitingValidation = 1,
    Submitted = 2,
    Confirmed = 3,
    Cancelled = 4,
    /// <summary>Checked and priced, waiting for the customer's online payment; the till does not see it yet.</summary>
    AwaitingPayment = 5
}
