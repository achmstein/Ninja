#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// How long the words of a delivery may be: the aggregate holds an order to
/// them and the database columns are made to them, so the two never differ.
/// </summary>
public static class DeliveryLimits
{
    public const int Address = 300;
    public const int Building = 100;
    public const int Floor = 50;
    public const int Apartment = 50;
    public const int Directions = 500;
    public const int Phone = 30;
    public const int Label = 50;
    public const int RiderUserId = 100;
    public const int RiderName = 200;
    public const int FailureReason = 300;
}

/// <summary>
/// The names of the delivery rules an order can break, as the API answers
/// them and the apps translate them. Stable: an app keys its words on these.
/// </summary>
public static class DeliveryErrors
{
    public const string NotDelivering = "delivery.not_delivering";
    public const string OutOfRange = "delivery.out_of_range";
    public const string BelowMinimum = "delivery.below_minimum";
    public const string PhoneInvalid = "delivery.phone_invalid";
    public const string AddressRequired = "delivery.address_required";
    public const string PinInvalid = "delivery.pin_invalid";
    public const string NameRequired = "delivery.name_required";
    /// <summary>The branch has delivery for signed-in customers only, and this is a guest.</summary>
    public const string SignInRequired = "delivery.sign_in_required";
    public const string PlaceConflict = "delivery.place_conflict";
    public const string TooLong = "delivery.too_long";
    public const string NotDelivery = "delivery.not_delivery";
    public const string NotConfirmed = "delivery.not_confirmed";
    public const string NoRider = "delivery.no_rider";
    public const string AlreadyOut = "delivery.already_out";
    public const string NotOut = "delivery.not_out";
    public const string AlreadyDelivered = "delivery.already_delivered";
    public const string NotDelivered = "delivery.not_delivered";
    public const string NotFailed = "delivery.not_failed";
    public const string AlreadySettled = "delivery.already_settled";
    public const string CashInvalid = "delivery.cash_invalid";
    /// <summary>Paid ahead online: nothing was collected at the door, so there is no cash to hand in.</summary>
    public const string PaidOnline = "delivery.paid_online";
    public const string Conflict = "delivery.conflict";
    public const string RiderUnknown = "rider.unknown";
    public const string RiderNotYours = "rider.not_yours";

    /// <summary>The rules an order breaks by where it stands, not by what was sent: answered 409.</summary>
    public static readonly IReadOnlySet<string> StateConflicts = new HashSet<string>
    {
        NotConfirmed, NoRider, AlreadyOut, NotOut, AlreadyDelivered, NotDelivered, NotFailed, AlreadySettled, PaidOnline, Conflict,
    };
}
