using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>
/// A promise that a party will occupy a place: who, where, for when, and
/// whether they turned up. It knows nothing about money — a reservation on
/// a timed place hands over to a <see cref="StayAggregate.Stay"/> the moment
/// the party is seated, and closes when that stay ends; one on a plain table
/// is the party at the table until the staff clear it, and the ticket on
/// the table does the rest. <see cref="For"/> null means "now": the
/// customer is on their way and has <see cref="HoldMinutes"/> to arrive.
/// </summary>
public class Reservation : Entity, IAggregateRoot
{
    /// <summary>How long a customer has to arrive on a reservation for now.</summary>
    public const int HoldMinutes = 10;

    /// <summary>How long after its time a customer's scheduled reservation waits before it lapses.</summary>
    public const int GraceMinutes = 30;

    /// <summary>Two reservations on one place closer than this collide.</summary>
    public const int SlotMinutes = 120;

    public int PlaceId { get; private set; }

    /// <summary>Loaded when needed.</summary>
    public Place? Place { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>Null for a reservation staff made for someone with no account.</summary>
    public string? CustomerId { get; private set; }
    public string? CustomerName { get; private set; }
    public int? PartySize { get; private set; }

    /// <summary>When the party is expected; null means now.</summary>
    public DateTime? For { get; private set; }

    public DateTime CreatedAt { get; private set; }

    /// <summary>When the reservation lapses unseated. Null: never (staff-made).</summary>
    public DateTime? ExpiresAt { get; private set; }

    /// <summary>On a timed place: the customer asked that the till's Confirm also start the clock.</summary>
    public bool StartOnConfirm { get; private set; }

    /// <summary>The rate option the clock should start at, on a timed place; null: the tariff's default, or the cashier picks.</summary>
    public string? RequestedOptionCode { get; private set; }

    public ReservationStatus Status { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>The stay that took over when the party was seated at a timed place.</summary>
    public int? StayId { get; private set; }

    public DateTime? SeatedAt { get; private set; }

    /// <summary>When it was cancelled, lapsed, or the party left.</summary>
    public DateTime? ClosedAt { get; private set; }

    protected Reservation() { }

    /// <param name="place">Where; must be reservable. Its tariff, if any, validates <paramref name="requestedOptionCode"/>.</param>
    /// <param name="isStaffCreated">Made at the till: not tied to an account, and never lapses.</param>
    public Reservation(
        Place place,
        string? customerId,
        string? customerName,
        DateTime? @for = null,
        int? partySize = null,
        string? notes = null,
        bool startOnConfirm = false,
        string? requestedOptionCode = null,
        bool isStaffCreated = false) : this()
    {
        ArgumentNullException.ThrowIfNull(place);
        if (!place.CanReserve)
            throw new SpacesDomainException("This place cannot be reserved");
        if (!isStaffCreated && string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");
        if (partySize is <= 0)
            throw new SpacesDomainException("A party has at least one person");

        var now = DateTime.UtcNow;
        if (@for is { } f && f <= now)
            throw new SpacesDomainException("A reservation is for later; leave the time out to reserve for now");

        PlaceId = place.Id;
        Place = place;
        BranchId = place.BranchId;
        CustomerId = string.IsNullOrWhiteSpace(customerId) ? null : customerId;
        CustomerName = customerName;
        PartySize = partySize;
        For = @for;
        Notes = notes;
        CreatedAt = now;
        Status = ReservationStatus.Requested;

        // The clock is the tariff's business: no tariff, nothing to start
        StartOnConfirm = startOnConfirm && place.IsTimed;
        RequestedOptionCode = StartOnConfirm && requestedOptionCode is not null
            ? place.Tariff!.Require(requestedOptionCode).Code
            : null;

        // Staff reservations wait for the staff; a customer's lapses on its own
        ExpiresAt = isStaffCreated ? null
            : @for is { } at ? at.AddMinutes(GraceMinutes)
            : now.AddMinutes(HoldMinutes);

        AddDomainEvent(new ReservationRequestedDomainEvent(this));
    }

    // ---- reading it

    public bool IsOpen => Status is ReservationStatus.Requested or ReservationStatus.Confirmed;

    /// <summary>The party is here now. At a plain table this is what keeps the table; at a timed place the stay does.</summary>
    public bool IsSeated => Status == ReservationStatus.Seated;

    /// <summary>When the party is expected: <see cref="For"/>, or when it was made for a reservation for now.</summary>
    public DateTime EffectiveFor => For ?? CreatedAt;

    /// <summary>Whether the reservation keeps the place at this moment: open, and its time is now or has come.</summary>
    public bool IsHolding(DateTime now) => IsOpen && (For is null || For <= now);

    public bool IsExpired(DateTime now) => IsOpen && ExpiresAt is { } at && now > at;

    public TimeSpan? TimeUntilExpiry(DateTime now)
    {
        if (!IsOpen || ExpiresAt is null)
            return null;
        var remaining = ExpiresAt.Value - now;
        return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
    }

    // ---- its life

    /// <summary>The café acknowledged it. Idempotent.</summary>
    public void Confirm()
    {
        if (!IsOpen)
            throw new SpacesDomainException($"Cannot confirm from status {Status}");
        Status = ReservationStatus.Confirmed;
    }

    /// <summary>The party arrived and sat down; on a timed place <paramref name="stayId"/> is the clock that took over.</summary>
    public void Seat(int? stayId = null)
    {
        if (!IsOpen)
            throw new SpacesDomainException($"Cannot seat from status {Status}");
        Status = ReservationStatus.Seated;
        SeatedAt = DateTime.UtcNow;
        StayId = stayId;
        AddDomainEvent(new ReservationSeatedDomainEvent(this));
    }

    /// <summary>The party left: the staff cleared the table, or the stay that took over ended.</summary>
    public void Complete()
    {
        if (!IsSeated)
            throw new SpacesDomainException($"Cannot complete from status {Status}");
        Status = ReservationStatus.Completed;
        ClosedAt = DateTime.UtcNow;
        AddDomainEvent(new ReservationCompletedDomainEvent(this));
    }

    /// <summary>Give a reservation the till made for an unnamed party its customer.</summary>
    public void AssignCustomer(string customerId, string? customerName)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");
        if (!IsOpen)
            throw new SpacesDomainException("Can only assign a customer to an open reservation");
        if (CustomerId != null)
            throw new SpacesDomainException("The reservation already has a customer");
        CustomerId = customerId;
        CustomerName = customerName;
    }

    /// <summary>Given up before anyone was seated, by the customer or the staff.</summary>
    public void Cancel()
    {
        if (!IsOpen)
            throw new SpacesDomainException($"Cannot cancel from status {Status}");
        var now = DateTime.UtcNow;
        var wasHolding = IsHolding(now);
        Status = ReservationStatus.Cancelled;
        ClosedAt = now;
        AddDomainEvent(new ReservationCancelledDomainEvent(this, wasHolding));
    }

    /// <summary>Its time to arrive ran out (no event: nothing to bill, nobody to tell).</summary>
    public void Expire()
    {
        if (!IsOpen)
            throw new SpacesDomainException("Only an open reservation lapses");
        Status = ReservationStatus.Expired;
        ClosedAt = DateTime.UtcNow;
    }
}
