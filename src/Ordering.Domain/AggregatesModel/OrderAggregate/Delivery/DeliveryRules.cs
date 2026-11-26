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

    /// <summary>A location link's token: 32 hex characters, with room.</summary>
    public const int LocationShareToken = 40;
    public const int Label = 50;
    public const int ZoneName = 80;
    public const int RiderUserId = 100;
    public const int RiderName = 200;
    public const int FailureReason = 300;
    public const int CourierProvider = 100;
    public const int CourierJobId = 100;
    public const int CourierTrackingUrl = 500;
}

/// <summary>
/// The names of the delivery rules an order can break, as the API answers
/// them and the apps translate them. Stable: an app keys its words on these.
/// </summary>
public static class DeliveryErrors
{
    public const string NotDelivering = "delivery.not_delivering";
    public const string OutOfRange = "delivery.out_of_range";
    /// <summary>The address is in a named area the branch stopped delivering to for a while.</summary>
    public const string ZoneOff = "delivery.area_off";
    /// <summary>The named area the till picked is not one of the branch's (any more).</summary>
    public const string ZoneUnknown = "delivery.area_unknown";
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
    /// <summary>The till named another branch for an order that is not a delivery.</summary>
    public const string SendNotDelivery = "delivery.send_not_delivery";
    /// <summary>The till named another branch for an order on one of its own bills.</summary>
    public const string SendWithTicket = "delivery.send_with_ticket";
    /// <summary>The branch the till named is not one of the business's, is closed, or does not deliver.</summary>
    public const string SendBranchClosed = "delivery.send_branch_closed";
    /// <summary>The courier company named is not one the business lists, or is switched off.</summary>
    public const string CourierUnknown = "courier.unknown";
    public const string CourierFeeInvalid = "courier.fee_invalid";
    /// <summary>The step is a courier's, and no courier company has this delivery.</summary>
    public const string NoCourier = "courier.none";
    /// <summary>The step is a rider's, and a courier company has this delivery.</summary>
    public const string CourierHasIt = "courier.has_it";
    /// <summary>A courier's delivery is said delivered with what the courier collected.</summary>
    public const string CourierAmountRequired = "courier.amount_required";
    /// <summary>A connected courier company did not take the job it was sent.</summary>
    public const string CourierUnreachable = "courier.unreachable";
    public const string RiderUnknown = "rider.unknown";
    public const string RiderNotYours = "rider.not_yours";

    /// <summary>The rules an order breaks by where it stands, not by what was sent: answered 409.</summary>
    public static readonly IReadOnlySet<string> StateConflicts = new HashSet<string>
    {
        NotConfirmed, NoRider, AlreadyOut, NotOut, AlreadyDelivered, NotDelivered, NotFailed, AlreadySettled, PaidOnline, Conflict,
        NoCourier, CourierHasIt, CourierAmountRequired, CourierUnreachable,
    };
}
