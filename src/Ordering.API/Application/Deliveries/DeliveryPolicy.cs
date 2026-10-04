#nullable enable
namespace Ninja.Ordering.API.Application.Deliveries;

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
    /// <exception cref="OrderingDomainException">With a <see cref="DeliveryErrors"/> code, when a rule is broken.</exception>
    Task<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery> BuildAsync(
        DeliveryDraft draft,
        int branchId,
        DeliveryTaker taker,
        string? fallbackPhone,
        decimal itemsSubtotal);
}

public class DeliveryPolicy(IBranchSettingsQueries branchSettings, TenantCountry country) : IDeliveryPolicy
{
    public async Task<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery> BuildAsync(
        DeliveryDraft draft,
        int branchId,
        DeliveryTaker taker,
        string? fallbackPhone,
        decimal itemsSubtotal)
    {
        var terms = await branchSettings.GetDeliveryTermsAsync(branchId, evenWhilePaused: taker == DeliveryTaker.Till)
            ?? throw new OrderingDomainException("This branch isn't delivering right now.", DeliveryErrors.NotDelivering);

        int? distance = draft is { Latitude: { } lat, Longitude: { } lng } && IsOnTheMap(lat, lng)
            ? Geo.DistanceMeters(terms.Latitude, terms.Longitude, lat, lng)
            : null;

        if (taker == DeliveryTaker.Customer)
        {
            // The customer pins the door; their order is held to the area and the minimum
            if (distance is null)
            {
                throw new OrderingDomainException("Pin the address on the map.", DeliveryErrors.PinInvalid);
            }

            if (distance > terms.RadiusMeters)
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
