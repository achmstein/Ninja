#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// The bill an order sits on was paid, voided or partly refunded. Carries
/// whose order it is — the buyer's identity when signed in, the guest id
/// when not — so Notification can nudge that one customer's screens to
/// refetch. No money travels; the order itself says what changed.
/// </summary>
public record OrderPaymentChangedIntegrationEvent(
    int OrderId,
    string? BuyerIdentityGuid,
    string? GuestId,
    string Change,
    int? ReceiptNumber,
    int BranchId) : IntegrationEvent;
