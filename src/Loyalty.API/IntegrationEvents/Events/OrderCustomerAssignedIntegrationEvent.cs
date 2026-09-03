namespace Chillax.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer is put on an order after it
/// was placed. Confirmation had nobody to credit, so the points it skipped
/// are awarded now, off the same total.
/// </summary>
public record OrderCustomerAssignedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; init; }

    /// <summary>The account now behind the order; null when only a name was given.</summary>
    public string? BuyerIdentityGuid { get; init; }

    /// <summary>
    /// The account the order was taken off, when it changed hands — the one
    /// whose points move to <see cref="BuyerIdentityGuid"/>. Null when the
    /// order had only a name, or nobody, before.
    /// </summary>
    public string? PreviousBuyerIdentityGuid { get; init; }

    public string? CustomerName { get; init; }

    /// <summary>Confirmed, Submitted, … — points are only ever awarded for a confirmed order.</summary>
    public string OrderStatus { get; init; } = default!;

    public decimal OrderTotal { get; init; }
}
