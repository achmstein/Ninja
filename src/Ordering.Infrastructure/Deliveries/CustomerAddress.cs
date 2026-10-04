#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// An address a signed-in customer keeps for delivery: a pin on the map and
/// the words that find the door. Not an aggregate — the customer's own list,
/// copied onto an order when they pick one; an order never points back at it.
/// A guest keeps theirs on the device instead.
/// </summary>
public class CustomerAddress
{
    public int Id { get; set; }

    /// <summary>The customer's account (the token's subject).</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>What the customer calls it: Home, Work, Mum's.</summary>
    public string? Label { get; set; }

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string Address { get; set; } = string.Empty;

    public string? Building { get; set; }

    public string? Floor { get; set; }

    public string? Apartment { get; set; }

    public string? Directions { get; set; }

    public string? Phone { get; set; }

    /// <summary>When it was last used for an order, so the latest comes first.</summary>
    public DateTime LastUsedAt { get; set; }
}
