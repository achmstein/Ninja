#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Where an order is to be delivered, as the customer's app or the till sent
/// it: the pin when there is one, and the words that find the door. Not yet
/// a delivery: <see cref="IDeliveryPolicy"/> holds it to the branch's terms.
/// </summary>
/// <param name="Phone">The number the rider calls; the guest's checkout phone when left out.</param>
public record DeliveryDraft(
    double? Latitude,
    double? Longitude,
    string Address,
    string? Building = null,
    string? Floor = null,
    string? Apartment = null,
    string? Directions = null,
    string? Phone = null);

/// <summary>Who is taking the delivery: a customer ordering, or the till over the phone.</summary>
public enum DeliveryTaker
{
    /// <summary>Held to the branch's area and minimum, while it takes orders.</summary>
    Customer,

    /// <summary>The cashier knows the streets: neither the area nor the minimum is held, and a pause does not stop it.</summary>
    Till,
}

/// <summary>
/// The one place a delivery is held to the branch's terms, for the customer's
/// order and the till's alike: whether it delivers at all, how far, for how
/// much, to which number. What the aggregate checks itself (the words, their
/// length, the pin both or neither) it checks again there.
/// </summary>
public interface IDeliveryPolicy
{
    /// <param name="itemsSubtotal">What the items come to as sent; the minimum is checked again at the menu's prices.</param>
    /// <param name="isGuest">The customer ordering has no account: refused where the branch delivers to signed-in customers only.</param>
    /// <exception cref="OrderingDomainException">With a <see cref="DeliveryErrors"/> code, when a rule is broken.</exception>
    Task<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery> BuildAsync(
        DeliveryDraft draft,
        int branchId,
        DeliveryTaker taker,
        string? fallbackPhone,
        decimal itemsSubtotal,
        bool isGuest = false);
}

public class DeliveryPolicy(IBranchSettingsQueries branchSettings, TenantCountry country) : IDeliveryPolicy
{
    public async Task<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery> BuildAsync(
        DeliveryDraft draft,
        int branchId,
        DeliveryTaker taker,
        string? fallbackPhone,
        decimal itemsSubtotal,
        bool isGuest = false)
    {
        var terms = await branchSettings.GetDeliveryTermsAsync(branchId, evenWhilePaused: taker == DeliveryTaker.Till)
            ?? throw new OrderingDomainException("This branch isn't delivering right now.", DeliveryErrors.NotDelivering);

        // The branch brings orders to the door of signed-in customers only; the till's phone orders are its own
        if (taker == DeliveryTaker.Customer && isGuest && terms.SignInRequired)
        {
            throw new OrderingDomainException("Sign in to order delivery from this branch.", DeliveryErrors.SignInRequired);
        }

        var pin = draft is { Latitude: { } lat, Longitude: { } lng } && IsOnTheMap(lat, lng)
            ? (Latitude: lat, Longitude: lng)
            : ((double Latitude, double Longitude)?)null;
        int? distance = pin is { } at ? terms.DistanceTo(at.Latitude, at.Longitude) : null;

        if (taker == DeliveryTaker.Customer)
        {
            // The customer pins the door; their order is held to the area and the minimum
            if (pin is not { } door)
            {
                throw new OrderingDomainException("Pin the address on the map.", DeliveryErrors.PinInvalid);
            }

            // Inside the drawn area when there is one, otherwise within the radius
            if (!terms.Covers(door.Latitude, door.Longitude))
            {
                throw new OrderingDomainException("This address is outside the branch's delivery area.", DeliveryErrors.OutOfRange);
            }

            if (itemsSubtotal < terms.MinimumOrder)
            {
                throw new OrderingDomainException($"Delivery needs an order of at least {terms.MinimumOrder:0.##}.", DeliveryErrors.BelowMinimum);
            }
        }

        var phone = PhoneRules.Normalize(string.IsNullOrWhiteSpace(draft.Phone) ? fallbackPhone : draft.Phone, country.Code);
        if (!PhoneRules.IsValid(phone, country.Code))
        {
            throw new OrderingDomainException("A valid phone number is required for delivery.", DeliveryErrors.PhoneInvalid);
        }

        // The words, their lengths and the pin (both or neither) are the aggregate's to judge
        return new Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery(
            draft.Latitude, draft.Longitude, draft.Address, draft.Building, draft.Floor,
            draft.Apartment, draft.Directions, phone!, terms.Fee, distance);
    }

    private static bool IsOnTheMap(double latitude, double longitude) =>
        latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;
}

/// <summary>
/// Which of the business's other branches the till offers to send a phone
/// delivery to. Every one that delivers to the pin when this branch does not;
/// when this branch does, only one clearly nearer, so a few hundred metres
/// never takes an order from the branch that answered the phone.
/// </summary>
public static class DeliveryAlternatives
{
    /// <summary>Clearly nearer: at most this share of this branch's distance…</summary>
    public const double NearerShare = 0.7;

    /// <summary>…and at least this much closer, in metres.</summary>
    public const int NearerByMeters = 1000;

    /// <param name="hereBranchId">The till's branch, never offered to itself.</param>
    /// <param name="here">The till's branch's terms.</param>
    /// <param name="branches">Every delivering branch, paused ones flagged.</param>
    public static IReadOnlyList<DeliveryAlternative> For(
        int hereBranchId,
        DeliveryTerms here,
        double latitude,
        double longitude,
        IEnumerable<BranchDeliveryTerms> branches)
    {
        var coveredHere = here.Covers(latitude, longitude);
        var hereDistance = here.DistanceTo(latitude, longitude);

        return branches
            .Where(b => b.BranchId != hereBranchId && b.Terms.Covers(latitude, longitude))
            .Select(b => (Branch: b, Distance: b.Terms.DistanceTo(latitude, longitude)))
            .Where(b => !coveredHere || IsClearlyNearer(b.Distance, hereDistance))
            .OrderBy(b => b.Distance)
            .ThenBy(b => b.Branch.BranchId)
            .Select(b => new DeliveryAlternative(b.Branch.BranchId, b.Distance, b.Branch.Terms.Fee, b.Branch.Terms.MinimumOrder, b.Branch.Paused))
            .ToList();
    }

    /// <summary>
    /// Every branch whose area takes the pin in, nearest first, paused ones
    /// flagged: the call centre's choice, where no branch answered the phone.
    /// </summary>
    public static IReadOnlyList<DeliveryAlternative> Reaching(double latitude, double longitude, IEnumerable<BranchDeliveryTerms> branches) =>
        branches
            .Where(b => b.Terms.Covers(latitude, longitude))
            .Select(b => (Branch: b, Distance: b.Terms.DistanceTo(latitude, longitude)))
            .OrderBy(b => b.Distance)
            .ThenBy(b => b.Branch.BranchId)
            .Select(b => new DeliveryAlternative(b.Branch.BranchId, b.Distance, b.Branch.Terms.Fee, b.Branch.Terms.MinimumOrder, b.Branch.Paused))
            .ToList();

    /// <summary>At least 30% and a kilometre closer than this branch.</summary>
    public static bool IsClearlyNearer(int distance, int hereDistance) =>
        distance <= hereDistance * NearerShare && hereDistance - distance >= NearerByMeters;
}
