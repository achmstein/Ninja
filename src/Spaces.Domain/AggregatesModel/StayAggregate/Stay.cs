using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

/// <summary>
/// One party's metered time at a timed place: the running clock, the
/// segments cut at every rate-option change, the party, the cost, and the
/// receipt Sales sends back. It begins running — as a walk-in, or when a
/// <see cref="Reservation"/> is seated — and ends or is cut short; the
/// promise before it belongs to the reservation.
/// </summary>
public class Stay : Entity, IAggregateRoot
{
    public int PlaceId { get; private set; }

    /// <summary>Loaded when needed.</summary>
    public Place? Place { get; private set; }

    /// <summary>The reservation this stay was seated from; null for a walk-in.</summary>
    public int? ReservationId { get; private set; }

    /// <summary>Null for a walk-in nobody has claimed yet.</summary>
    public string? CustomerId { get; private set; }
    public string? CustomerName { get; private set; }

    private readonly List<StayMember> _members = new();
    public IReadOnlyCollection<StayMember> Members => _members.AsReadOnly();

    private readonly List<StaySegment> _segments = new();
    public IReadOnlyCollection<StaySegment> Segments => _segments.AsReadOnly();

    public DateTime CreatedAt { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }

    /// <summary>The place's tariff as it was when the stay began; what this stay is charged by.</summary>
    public Tariff Tariff { get; private set; } = null!;

    /// <summary>The rate option in force while running; null otherwise.</summary>
    public string? CurrentOptionCode { get; private set; }

    /// <summary>Known once ended.</summary>
    public decimal? TotalCost { get; private set; }

    /// <summary>The receipt the till settled this time on — projected from Sales, never set here.</summary>
    public int? ReceiptNumber { get; private set; }
    public DateTime? PaidAt { get; private set; }

    /// <summary>The Sales ticket the time was billed on — what the receipt link opens.</summary>
    public int? TicketId { get; private set; }

    /// <summary>"Cash", "Card", "InstaPay", "Account" or "Mixed".</summary>
    public string? PaidWith { get; private set; }

    public StayStatus Status { get; private set; }
    public string? Notes { get; private set; }

    protected Stay() { }

    private static Stay Begin(int placeId, Tariff tariff, string? customerId, string? customerName, string? optionCode, string? notes, int? reservationId)
    {
        ArgumentNullException.ThrowIfNull(tariff);
        var snapshot = tariff.Snapshot();
        var option = optionCode is null ? snapshot.Default : snapshot.Require(optionCode);

        var now = DateTime.UtcNow;
        var stay = new Stay
        {
            PlaceId = placeId,
            ReservationId = reservationId,
            Tariff = snapshot,
            CustomerId = string.IsNullOrWhiteSpace(customerId) ? null : customerId,
            CustomerName = customerName,
            CreatedAt = now,
            StartedAt = now,
            CurrentOptionCode = option.Code,
            Notes = notes,
            Status = StayStatus.Running,
        };
        stay._segments.Add(new StaySegment(0, option.Code, option.HourlyRate, now));

        stay.AddDomainEvent(new StayStartedDomainEvent(stay));
        return stay;
    }

    /// <summary>
    /// A walk-in: the clock starts now. With no customer, the first person to
    /// scan the place's QR becomes the owner.
    /// </summary>
    public static Stay CreateWalkIn(
        int placeId,
        Tariff tariff,
        string? customerId = null,
        string? customerName = null,
        string? optionCode = null,
        string? notes = null)
        => Begin(placeId, tariff, customerId, customerName, optionCode, notes, reservationId: null);

    /// <summary>
    /// A reservation's party sat down at a timed place: the clock starts now,
    /// at the option the till names, else the one the customer asked for,
    /// else the tariff's default. The reserving customer is in the party.
    /// </summary>
    public static Stay FromReservation(Reservation reservation, Tariff tariff, string? optionCode = null)
    {
        ArgumentNullException.ThrowIfNull(reservation);
        var stay = Begin(
            reservation.PlaceId,
            tariff,
            reservation.CustomerId,
            reservation.CustomerName,
            optionCode ?? reservation.RequestedOptionCode,
            reservation.Notes,
            reservation.Id);
        if (stay.CustomerId is { } owner)
            stay._members.Add(new StayMember(stay.Id, owner, stay.CustomerName, StayMemberRole.Owner));
        return stay;
    }

    // ---- the clock

    /// <summary>Switch the rate option mid-stay: closes the open segment and opens a new one.</summary>
    public void ChangeOption(string optionCode)
    {
        if (Status != StayStatus.Running)
            throw new SpacesDomainException("Can only change the rate on a running stay");

        var option = Tariff.Require(optionCode);
        if (string.Equals(CurrentOptionCode, option.Code, StringComparison.OrdinalIgnoreCase))
            throw new SpacesDomainException($"The stay is already on {option.Name.En}");

        var now = DateTime.UtcNow;
        _segments.LastOrDefault(s => s.EndTime == null)?.End(now);
        _segments.Add(new StaySegment(Id, option.Code, option.HourlyRate, now));
        CurrentOptionCode = option.Code;
    }

    /// <summary>Stop the clock and settle the cost (the till's action).</summary>
    public void End()
    {
        if (Status != StayStatus.Running)
            throw new SpacesDomainException($"Cannot end from status {Status}. Only running stays can be ended.");

        var now = DateTime.UtcNow;
        EndedAt = now;
        _segments.LastOrDefault(s => s.EndTime == null)?.End(now);
        TotalCost = CostBreakdown().Sum(c => c.Cost);
        Status = StayStatus.Ended;
        CurrentOptionCode = null;

        AddDomainEvent(new StayEndedDomainEvent(this));
    }

    /// <summary>Cut a running stay short; nothing is billed.</summary>
    public void Cancel()
    {
        if (Status != StayStatus.Running)
            throw new SpacesDomainException($"Cannot cancel from status {Status}. Only a running stay can be cut short.");

        EndedAt = DateTime.UtcNow;
        _segments.LastOrDefault(s => s.EndTime == null)?.End(EndedAt.Value);
        Status = StayStatus.Cancelled;
        CurrentOptionCode = null;

        AddDomainEvent(new StayCancelledDomainEvent(this));
    }

    /// <summary>
    /// The receipt that covered this stay. Idempotent on the receipt number
    /// (the bus redelivers); returns whether anything changed.
    /// </summary>
    public bool MarkPaid(int receiptNumber, string tender, DateTime at, int? ticketId = null, int? branchId = null)
    {
        if (ReceiptNumber == receiptNumber)
            return false;
        ReceiptNumber = receiptNumber;
        PaidWith = tender;
        PaidAt = at;
        TicketId = ticketId ?? TicketId;
        AddDomainEvent(new StayPaidDomainEvent(this, receiptNumber, branchId ?? Place?.BranchId ?? 1));
        return true;
    }

    // ---- reading the clock

    public RateOption? CurrentOption => Tariff.Find(CurrentOptionCode);

    public bool IsOpen => Status == StayStatus.Running;

    public TimeSpan? GetCurrentDuration()
        => Status == StayStatus.Running ? DateTime.UtcNow - StartedAt : null;

    /// <summary>Hours billed on one option: its closed segments, rounded by the tariff.</summary>
    public decimal HoursFor(string optionCode)
    {
        var minutes = _segments
            .Where(s => s.EndTime != null && s.OptionCode.Equals(optionCode, StringComparison.OrdinalIgnoreCase))
            .Sum(s => (s.EndTime!.Value - s.StartTime).TotalMinutes);
        return Tariff.RoundHours(minutes);
    }

    public decimal CostFor(string optionCode)
    {
        var option = Tariff.Find(optionCode);
        return option is null ? 0 : HoursFor(option.Code) * option.HourlyRate;
    }

    /// <summary>One line per option of the tariff, in tariff order, zero hours included.</summary>
    public IReadOnlyList<StayCost> CostBreakdown()
        => Tariff.Options
            .Select(o =>
            {
                var hours = HoursFor(o.Code);
                return new StayCost(o.Code, o.Name, o.HourlyRate, hours, hours * o.HourlyRate);
            })
            .ToList();

    // ---- the party

    /// <summary>Add someone to the party. The first joiner of an unclaimed walk-in becomes the owner.</summary>
    public void AddMember(string customerId, string? customerName)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        // Until the bill is settled the till can still name who was there —
        // someone who never scanned, whose share of the time goes on their
        // own tab. Sales owns the bill; the roster lives here.
        if (Status != StayStatus.Running && Status != StayStatus.Ended)
            throw new SpacesDomainException("Can only add members to a running or ended stay");

        if (HasMember(customerId))
            throw new SpacesDomainException("Customer is already a member of this stay");

        var role = StayMemberRole.Member;
        if (CustomerId == null && _members.Count == 0)
        {
            role = StayMemberRole.Owner;
            CustomerId = customerId;
            CustomerName = customerName;
        }

        _members.Add(new StayMember(Id, customerId, customerName, role));
        AddDomainEvent(new StayMemberJoinedDomainEvent(this, customerId));
    }

    public void RemoveMember(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        var member = _members.FirstOrDefault(m => m.CustomerId == customerId)
            ?? throw new SpacesDomainException("Customer is not a member of this stay");

        if (member.Role == StayMemberRole.Owner)
            throw new SpacesDomainException("Cannot remove the owner");

        _members.Remove(member);
    }

    public bool HasMember(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            return false;
        return CustomerId == customerId || _members.Any(m => m.CustomerId == customerId);
    }

    public StayMemberRole? GetMemberRole(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            return null;
        if (CustomerId == customerId)
            return StayMemberRole.Owner;
        return _members.FirstOrDefault(m => m.CustomerId == customerId)?.Role;
    }

    /// <summary>Give an unclaimed stay its owner (the till's action).</summary>
    public void AssignCustomer(string customerId, string? customerName)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");
        if (!IsOpen)
            throw new SpacesDomainException("Can only assign customers to a running stay");
        if (CustomerId != null)
            throw new SpacesDomainException("The stay already has a customer");

        CustomerId = customerId;
        CustomerName = customerName;

        // They are in the party now, and are told so — the way a member who
        // scanned in is told — so their phone shows it
        if (!_members.Any(m => m.CustomerId == customerId))
        {
            _members.Add(new StayMember(Id, customerId, customerName, StayMemberRole.Owner));
            AddDomainEvent(new StayMemberJoinedDomainEvent(this, customerId));
        }

        AddDomainEvent(new StayCustomerAssignedDomainEvent(this, customerId));
    }
}

/// <summary>What one rate option of a stay cost: the line Sales prints.</summary>
public record StayCost(string OptionCode, LocalizedText OptionName, decimal HourlyRate, decimal Hours, decimal Cost);
