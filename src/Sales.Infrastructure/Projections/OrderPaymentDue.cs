#nullable enable
namespace Ninja.Sales.Infrastructure.Projections;

/// <summary>Where an order paid ahead stands with its payment, as Sales sees it.</summary>
public enum OrderPaymentDueStatus
{
    /// <summary>Waiting for the customer's payment; a checkout may be open for it.</summary>
    Due = 0,

    /// <summary>Paid; Ordering was told, and the order went to the till.</summary>
    Paid = 1,

    /// <summary>The order was cancelled (not paid in time, the customer gave up, or the till turned it down).</summary>
    Cancelled = 2,
}

/// <summary>
/// An order paid ahead online, as Ordering said it waits for its payment:
/// what to take (exactly <see cref="Amount"/>, from whoever placed it) and by
/// when. The customer's app starts the payment against it; its row is locked
/// while a checkout starts, so one order never has two checkouts open. One
/// per order, keyed by Ordering's id.
/// </summary>
public class OrderPaymentDue
{
    public int OrderId { get; set; }

    public int BranchId { get; set; }

    /// <summary>What the order comes to: what the payment pays (the guest's fee, when they carry it, on top).</summary>
    public decimal Amount { get; set; }

    /// <summary>The signed-in customer who placed it; null for a guest.</summary>
    public string? PayerUserId { get; set; }

    /// <summary>The guest's device it was placed from; null for a signed-in customer.</summary>
    public string? PayerGuestId { get; set; }

    public string PayerName { get; set; } = string.Empty;

    /// <summary>For the provider's checkout, when the order carries one.</summary>
    public string? Phone { get; set; }

    /// <summary>Brought to a door; otherwise the customer collects it.</summary>
    public bool IsDelivery { get; set; }

    /// <summary>When Ordering cancels it unpaid.</summary>
    public DateTime DueBy { get; set; }

    public OrderPaymentDueStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Whether <paramref name="userId"/> or <paramref name="guestId"/> placed the order.</summary>
    public bool IsPlacedBy(string? userId, string? guestId) =>
        (!string.IsNullOrEmpty(userId) && userId == PayerUserId)
        || (string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(guestId) && guestId == PayerGuestId);
}
