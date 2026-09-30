#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>How a delivery platform's order leaves the business.</summary>
public enum PlatformExpedition
{
    /// <summary>The platform's rider collects it at the counter and delivers it; no address reaches us.</summary>
    PlatformDelivery = 0,

    /// <summary>The business's own rider delivers it, to the address the platform sends.</summary>
    VendorDelivery = 1,

    /// <summary>The customer collects it.</summary>
    Pickup = 2,
}

/// <summary>The platform's reasons for turning an order down, as it spells them.</summary>
public static class PlatformRejectReasons
{
    /// <summary>Something on the order is sold out here.</summary>
    public const string ItemUnavailable = "ITEM_UNAVAILABLE";

    /// <summary>Staff turned it down without saying why.</summary>
    public const string TooBusy = "TOO_BUSY";

    /// <summary>The order names something this menu does not have: a remote code we never sent.</summary>
    public const string MenuAccountSettings = "MENU_ACCOUNT_SETTINGS";

    public const string Closed = "CLOSED";

    public const string TechnicalProblem = "TECHNICAL_PROBLEM";

    /// <summary>The ones staff may pick from at the till, before accepting.</summary>
    public static readonly IReadOnlyList<string> ForStaff = [TooBusy, ItemUnavailable, Closed, "NO_COURIER", "OUTSIDE_DELIVERY_AREA", "FRAUD_PRANK"];
}

/// <summary>
/// What a delivery platform (Talabat) said about an order it dispatched to the
/// business, kept on the order: the token the platform knows it by, the code the
/// rider asks for at the counter, how it leaves, and where to report back.
/// No delivery logic hangs off it — the platform runs the delivery; the business
/// makes the order and hands it over.
/// </summary>
public class PlatformOrder
{
    /// <summary>"Talabat".</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>The platform's id for the order; every status update names it.</summary>
    public string Token { get; private set; } = string.Empty;

    /// <summary>The order code the platform shows its rider and the customer.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>A shorter code some platforms print for the counter; null when none was sent.</summary>
    public string? ShortCode { get; private set; }

    public PlatformExpedition Expedition { get; private set; }

    /// <summary>When the platform's rider comes for it, for a platform delivery.</summary>
    public DateTime? RiderPickupAt { get; private set; }

    /// <summary>When the customer expects it: delivered, or ready to collect.</summary>
    public DateTime? DueAt { get; private set; }

    /// <summary>Where the business's rider takes it; only a vendor delivery has one.</summary>
    public string? DeliveryAddress { get; private set; }

    /// <summary>The customer paid the platform; nothing is collected at the door.</summary>
    public bool PaidOnline { get; private set; }

    /// <summary>What the rider collects from the customer when it was not paid online.</summary>
    public decimal? CollectFromCustomer { get; private set; }

    /// <summary>
    /// The addresses the platform said to report each change to. One left out
    /// means that change is not reported for this order.
    /// </summary>
    public string? AcceptedUrl { get; private set; }

    public string? RejectedUrl { get; private set; }

    public string? PreparedUrl { get; private set; }

    public string? PickedUpUrl { get; private set; }

    /// <summary>
    /// Why the business turned it down, in the platform's words (ITEM_UNAVAILABLE,
    /// TOO_BUSY, …); set when the order is cancelled on our side.
    /// </summary>
    public string? RejectReason { get; private set; }

    /// <summary>The platform cancelled it (the customer, or nobody answered in time).</summary>
    public DateTime? CancelledAt { get; private set; }

    /// <summary>The platform's rider collected it.</summary>
    public DateTime? PickedUpAt { get; private set; }

    protected PlatformOrder() { }

    public PlatformOrder(
        string name,
        string token,
        string code,
        string? shortCode,
        PlatformExpedition expedition,
        DateTime? riderPickupAt,
        DateTime? dueAt,
        string? deliveryAddress,
        bool paidOnline,
        decimal? collectFromCustomer,
        string? acceptedUrl,
        string? rejectedUrl,
        string? preparedUrl,
        string? pickedUpUrl)
    {
        Name = !string.IsNullOrWhiteSpace(name) ? name : throw new OrderingDomainException("A platform order needs the platform's name.");
        Token = !string.IsNullOrWhiteSpace(token) ? token : throw new OrderingDomainException("A platform order needs the platform's token.");
        Code = string.IsNullOrWhiteSpace(code) ? token : code;
        ShortCode = string.IsNullOrWhiteSpace(shortCode) ? null : shortCode;
        Expedition = expedition;
        RiderPickupAt = riderPickupAt;
        DueAt = dueAt;
        // Only the business's own rider needs to know where it goes
        DeliveryAddress = expedition == PlatformExpedition.VendorDelivery && !string.IsNullOrWhiteSpace(deliveryAddress) ? deliveryAddress : null;
        PaidOnline = paidOnline;
        CollectFromCustomer = paidOnline ? null : collectFromCustomer;
        AcceptedUrl = acceptedUrl;
        RejectedUrl = rejectedUrl;
        PreparedUrl = preparedUrl;
        PickedUpUrl = pickedUpUrl;
    }

    internal void Reject(string reason) => RejectReason ??= reason;

    internal void MarkCancelled(DateTime at) => CancelledAt ??= at;

    internal void MarkPickedUp(DateTime at) => PickedUpAt ??= at;
}
