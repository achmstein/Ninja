#nullable enable
namespace Ninja.Ordering.API.Application.Deliveries;

/// <summary>
/// The delivery's numbers, in one place and configurable under
/// <c>Delivery:</c>: how long a rider's silence means they are gone, how far
/// back the till's board and a rider's list reach, how much a caller's
/// history and a customer's address book hold.
/// </summary>
public sealed class DeliveryOptions
{
    public const string Section = "Delivery";

    /// <summary>The realm role a rider's account holds.</summary>
    public const string RiderRole = "Rider";

    /// <summary>
    /// A rider not heard from in this long has closed the app, on duty or not.
    /// The rider app beats every few minutes; this is a few beats.
    /// </summary>
    public TimeSpan RiderGone { get; set; } = TimeSpan.FromMinutes(15);

    /// <summary>How long a finished delivery stays on the till's board and in the rider's list.</summary>
    public TimeSpan RecentlyFinished { get; set; } = TimeSpan.FromHours(24);

    /// <summary>The oldest confirmed delivery the board and a rider's list still show, finished or not.</summary>
    public TimeSpan OpenWindow { get; set; } = TimeSpan.FromDays(2);

    /// <summary>The most deliveries one answer carries.</summary>
    public int MaxListed { get; set; } = 200;

    /// <summary>A caller's few earlier addresses, not their whole history.</summary>
    public int MaxKnownAddresses { get; set; } = 6;

    /// <summary>How many earlier deliveries are looked through for a caller's addresses.</summary>
    public int KnownAddressLookback { get; set; } = 30;

    /// <summary>A customer keeps a handful of addresses, not a phone book.</summary>
    public int MaxSavedAddresses { get; set; } = 20;
}
