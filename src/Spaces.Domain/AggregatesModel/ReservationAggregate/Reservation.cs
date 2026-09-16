using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

/// <summary>
/// Reservation aggregate - handles both reservations and active sessions
/// This is the primary aggregate for customer interactions
/// </summary>
public class Reservation : Entity, IAggregateRoot
{
    /// <summary>
    /// Time in minutes before a reservation expires if not started
    /// </summary>
    public const int ReservationExpirationMinutes = 10;

    public int RoomId { get; private set; }

    /// <summary>
    /// Navigation property to Room (loaded when needed)
    /// </summary>
    public Room? Room { get; private set; }

    /// <summary>
    /// Customer ID - nullable for walk-ins that have no owner initially
    /// </summary>
    public string? CustomerId { get; private set; }
    public string? CustomerName { get; private set; }

    private readonly List<SessionMember> _sessionMembers = new();
    public IReadOnlyCollection<SessionMember> SessionMembers => _sessionMembers.AsReadOnly();

    private readonly List<SessionSegment> _sessionSegments = new();
    public IReadOnlyCollection<SessionSegment> SessionSegments => _sessionSegments.AsReadOnly();

    /// <summary>
    /// When the reservation was created (customer has 15 min to arrive from this time)
    /// </summary>
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// When this reservation expires. Null means it never expires (admin-created reservations).
    /// </summary>
    public DateTime? ExpiresAt { get; private set; }

    /// <summary>
    /// Actual session start time (when admin clicks start)
    /// </summary>
    public DateTime? ActualStartTime { get; private set; }

    /// <summary>
    /// Session end time (when admin clicks end)
    /// </summary>
    public DateTime? EndTime { get; private set; }

    /// <summary>
    /// Single player mode hourly rate locked at reservation time
    /// </summary>
    public decimal SingleRate { get; private set; }

    /// <summary>
    /// Multi player mode hourly rate locked at reservation time
    /// </summary>
    public decimal MultiRate { get; private set; }

    /// <summary>
    /// Current player mode during an active session
    /// </summary>
    public PlayerMode? CurrentPlayerMode { get; private set; }

    /// <summary>
    /// Calculated total cost when session ends
    /// </summary>
    public decimal? TotalCost { get; private set; }

    /// <summary>
    /// The receipt the till settled this session's time on — projected from
    /// Sales' TicketSettled event, never set here. Null until the bill is paid.
    /// </summary>
    public int? ReceiptNumber { get; private set; }

    public DateTime? PaidAt { get; private set; }

    /// <summary>The Sales ticket the time was billed on — what the receipt link opens.</summary>
    public int? TicketId { get; private set; }

    /// <summary>"Cash", "Card", "InstaPay", "Account" (the customer's tab) or "Mixed".</summary>
    public string? PaidWith { get; private set; }

    public ReservationStatus Status { get; private set; }

    public string? Notes { get; private set; }

    protected Reservation()
    {
    }

    /// <summary>
    /// Create a new immediate reservation (customer has <see cref="ReservationExpirationMinutes"/> minutes to arrive)
    /// </summary>
    public Reservation(
        int roomId,
        string? customerId,
        string? customerName,
        decimal singleRate,
        decimal multiRate,
        string? notes = null,
        bool isAdminCreated = false) : this()
    {
        if (!isAdminCreated && string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        if (singleRate <= 0)
            throw new SpacesDomainException("Single rate must be greater than zero");

        if (multiRate <= 0)
            throw new SpacesDomainException("Multi rate must be greater than zero");

        RoomId = roomId;
        CustomerId = customerId;
        CustomerName = customerName;
        SingleRate = singleRate;
        MultiRate = multiRate;
        Notes = notes;
        CreatedAt = DateTime.UtcNow;
        ExpiresAt = isAdminCreated ? null : CreatedAt.AddMinutes(ReservationExpirationMinutes);
        Status = ReservationStatus.Reserved;

        AddDomainEvent(new RoomReservedDomainEvent(this));
    }

    /// <summary>
    /// Create an immediate session (walk-in, starts now) with an assigned customer
    /// </summary>
    public static Reservation CreateWalkIn(
        int roomId,
        string customerId,
        string? customerName,
        decimal singleRate,
        decimal multiRate,
        PlayerMode initialMode = PlayerMode.Single,
        string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        if (singleRate <= 0)
            throw new SpacesDomainException("Single rate must be greater than zero");

        if (multiRate <= 0)
            throw new SpacesDomainException("Multi rate must be greater than zero");

        var now = DateTime.UtcNow;
        var reservation = new Reservation
        {
            RoomId = roomId,
            CustomerId = customerId,
            CustomerName = customerName,
            ActualStartTime = now,
            SingleRate = singleRate,
            MultiRate = multiRate,
            CurrentPlayerMode = initialMode,
            Notes = notes,
            CreatedAt = now,
            Status = ReservationStatus.Active
        };

        var rate = initialMode == PlayerMode.Single ? singleRate : multiRate;
        reservation._sessionSegments.Add(new SessionSegment(0, initialMode, rate, now));

        reservation.AddDomainEvent(new SessionStartedDomainEvent(reservation));
        return reservation;
    }

    /// <summary>
    /// Create an immediate session (walk-in, starts now) without an assigned customer.
    /// The first customer to join via QR scan becomes the owner.
    /// </summary>
    public static Reservation CreateWalkInWithoutOwner(
        int roomId,
        decimal singleRate,
        decimal multiRate,
        PlayerMode initialMode = PlayerMode.Single,
        string? notes = null)
    {
        if (singleRate <= 0)
            throw new SpacesDomainException("Single rate must be greater than zero");

        if (multiRate <= 0)
            throw new SpacesDomainException("Multi rate must be greater than zero");

        var now = DateTime.UtcNow;
        var reservation = new Reservation
        {
            RoomId = roomId,
            CustomerId = null,
            CustomerName = null,
            ActualStartTime = now,
            SingleRate = singleRate,
            MultiRate = multiRate,
            CurrentPlayerMode = initialMode,
            Notes = notes,
            CreatedAt = now,
            Status = ReservationStatus.Active
        };

        var rate = initialMode == PlayerMode.Single ? singleRate : multiRate;
        reservation._sessionSegments.Add(new SessionSegment(0, initialMode, rate, now));

        reservation.AddDomainEvent(new SessionStartedDomainEvent(reservation));
        return reservation;
    }

    /// <summary>
    /// Start the session (admin action)
    /// </summary>
    public void StartSession(PlayerMode initialMode = PlayerMode.Single)
    {
        if (Status != ReservationStatus.Reserved)
            throw new SpacesDomainException($"Cannot start session from status {Status}. Only reserved sessions can be started.");

        var now = DateTime.UtcNow;
        ActualStartTime = now;
        Status = ReservationStatus.Active;
        CurrentPlayerMode = initialMode;

        var rate = initialMode == PlayerMode.Single ? SingleRate : MultiRate;
        _sessionSegments.Add(new SessionSegment(Id, initialMode, rate, now));

        // Add the assigned customer as Owner session member now that session is active
        if (!string.IsNullOrWhiteSpace(CustomerId) && !_sessionMembers.Any(m => m.CustomerId == CustomerId))
        {
            _sessionMembers.Add(new SessionMember(Id, CustomerId, CustomerName, SessionMemberRole.Owner));
        }

        AddDomainEvent(new SessionStartedDomainEvent(this));
    }

    /// <summary>
    /// Change the player mode mid-session. Ends the current segment and starts a new one.
    /// </summary>
    public void ChangePlayerMode(PlayerMode newMode)
    {
        if (Status != ReservationStatus.Active)
            throw new SpacesDomainException("Can only change player mode on active sessions");

        if (CurrentPlayerMode == newMode)
            throw new SpacesDomainException($"Session is already in {newMode} mode");

        var now = DateTime.UtcNow;

        // End the current open segment
        var currentSegment = _sessionSegments.LastOrDefault(s => s.EndTime == null);
        currentSegment?.End(now);

        // Start a new segment with the new mode
        var rate = newMode == PlayerMode.Single ? SingleRate : MultiRate;
        _sessionSegments.Add(new SessionSegment(Id, newMode, rate, now));

        CurrentPlayerMode = newMode;
    }

    /// <summary>
    /// End the session and calculate cost (admin action)
    /// </summary>
    public void EndSession()
    {
        if (Status != ReservationStatus.Active)
            throw new SpacesDomainException($"Cannot end session from status {Status}. Only active sessions can be ended.");

        if (ActualStartTime == null)
            throw new SpacesDomainException("Session was never started");

        var now = DateTime.UtcNow;
        EndTime = now;

        // Close the last open segment
        var openSegment = _sessionSegments.LastOrDefault(s => s.EndTime == null);
        openSegment?.End(now);

        TotalCost = CalculateCost();
        Status = ReservationStatus.Completed;
        CurrentPlayerMode = null;

        AddDomainEvent(new SessionEndedDomainEvent(this));
    }

    /// <summary>
    /// The receipt that covered this session. Idempotent on the receipt
    /// number (the bus redelivers); returns whether anything changed.
    /// </summary>
    public bool MarkPaid(int receiptNumber, string tender, DateTime at, int? ticketId = null)
    {
        if (ReceiptNumber == receiptNumber)
            return false;
        ReceiptNumber = receiptNumber;
        PaidWith = tender;
        PaidAt = at;
        TicketId = ticketId ?? TicketId;
        return true;
    }

    /// <summary>
    /// Cancel the reservation
    /// </summary>
    public void Cancel()
    {
        if (Status == ReservationStatus.Completed)
            throw new SpacesDomainException("Cannot cancel a completed session");

        if (Status == ReservationStatus.Cancelled)
            throw new SpacesDomainException("Reservation is already cancelled");

        var previousStatus = Status;
        Status = ReservationStatus.Cancelled;
        CurrentPlayerMode = null;

        AddDomainEvent(new ReservationCancelledDomainEvent(this, previousStatus));
    }

    /// <summary>
    /// Calculate cost based on segments (rounds each mode's total to nearest quarter hour)
    /// </summary>
    private decimal CalculateCost()
    {
        return GetSingleCost() + GetMultiCost();
    }

    /// <summary>
    /// Get cost for Single mode segments
    /// </summary>
    public decimal GetSingleCost()
    {
        var hours = GetSingleRoundedHours();
        return hours * SingleRate;
    }

    /// <summary>
    /// Get cost for Multi mode segments
    /// </summary>
    public decimal GetMultiCost()
    {
        var hours = GetMultiRoundedHours();
        return hours * MultiRate;
    }

    /// <summary>
    /// Get total duration in Single mode, rounded to nearest quarter hour
    /// </summary>
    public decimal GetSingleRoundedHours()
    {
        return GetRoundedHoursForMode(PlayerMode.Single);
    }

    /// <summary>
    /// Get total duration in Multi mode, rounded to nearest quarter hour
    /// </summary>
    public decimal GetMultiRoundedHours()
    {
        return GetRoundedHoursForMode(PlayerMode.Multi);
    }

    private decimal GetRoundedHoursForMode(PlayerMode mode)
    {
        var totalMinutes = _sessionSegments
            .Where(s => s.PlayerMode == mode && s.EndTime != null)
            .Sum(s => (s.EndTime!.Value - s.StartTime).TotalMinutes);

        if (totalMinutes <= 0)
            return 0;

        var quarters = Math.Round(totalMinutes / 15, MidpointRounding.AwayFromZero);
        return (decimal)quarters * 0.25m;
    }

    /// <summary>
    /// Get current session duration if active
    /// </summary>
    public TimeSpan? GetCurrentDuration()
    {
        if (Status != ReservationStatus.Active || ActualStartTime == null)
            return null;

        return DateTime.UtcNow - ActualStartTime.Value;
    }

    /// <summary>
    /// Get the formatted duration string (HH:MM:SS)
    /// </summary>
    public string GetFormattedDuration()
    {
        var duration = GetCurrentDuration();
        if (duration == null)
            return "00:00:00";

        return duration.Value.ToString(@"hh\:mm\:ss");
    }

    /// <summary>
    /// Check if reservation is for active/reserved status (not completed/cancelled)
    /// </summary>
    public bool IsActiveOrReserved()
    {
        return Status == ReservationStatus.Active || Status == ReservationStatus.Reserved;
    }

    /// <summary>
    /// Check if this reservation has expired (reserved but not started within timeout)
    /// </summary>
    public bool IsExpired()
    {
        if (Status != ReservationStatus.Reserved)
            return false;

        return ExpiresAt != null && DateTime.UtcNow > ExpiresAt;
    }

    /// <summary>
    /// Get the expiration time for this reservation
    /// </summary>
    public DateTime? GetExpirationTime()
    {
        if (Status != ReservationStatus.Reserved)
            return null;

        return ExpiresAt;
    }

    /// <summary>
    /// Get remaining time before expiration (null if not reserved, already expired, or never expires)
    /// </summary>
    public TimeSpan? GetTimeUntilExpiration()
    {
        if (Status != ReservationStatus.Reserved || ExpiresAt == null)
            return null;

        var remaining = ExpiresAt.Value - DateTime.UtcNow;

        return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
    }

    /// <summary>
    /// Cancel reservation due to expiration (no-show)
    /// </summary>
    public void CancelDueToExpiration()
    {
        if (Status != ReservationStatus.Reserved)
            throw new SpacesDomainException("Only reserved sessions can be cancelled due to expiration");

        Status = ReservationStatus.Cancelled;
        EndTime = DateTime.UtcNow;
    }

    /// <summary>
    /// Add a member to the session. First joiner of a walk-in session becomes the owner.
    /// </summary>
    public void AddMember(string customerId, string? customerName)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        // Until the bill is settled the till can still name who was in the
        // room — someone who never scanned the QR, whose share of the time
        // goes on their own tab. Sales owns the bill; the roster lives here.
        if (Status != ReservationStatus.Active && Status != ReservationStatus.Completed)
            throw new SpacesDomainException("Can only add members to an active or ended session");

        if (HasMember(customerId))
            throw new SpacesDomainException("Customer is already a member of this session");

        // Determine role: first joiner of walk-in (no owner) becomes owner
        var role = SessionMemberRole.Member;
        if (CustomerId == null && !_sessionMembers.Any())
        {
            role = SessionMemberRole.Owner;
            // Also set as the primary customer
            CustomerId = customerId;
            CustomerName = customerName;
        }

        var member = new SessionMember(Id, customerId, customerName, role);
        _sessionMembers.Add(member);

        AddDomainEvent(new SessionMemberJoinedDomainEvent(this, customerId));
    }

    /// <summary>
    /// Remove a member from the session
    /// </summary>
    public void RemoveMember(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        var member = _sessionMembers.FirstOrDefault(m => m.CustomerId == customerId);
        if (member == null)
            throw new SpacesDomainException("Customer is not a member of this session");

        if (member.Role == SessionMemberRole.Owner)
            throw new SpacesDomainException("Cannot remove the session owner");

        _sessionMembers.Remove(member);
    }

    /// <summary>
    /// Check if a customer is a member (owner or member) of this session
    /// </summary>
    public bool HasMember(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            return false;

        // Check if they're the primary customer
        if (CustomerId == customerId)
            return true;

        // Check session members list
        return _sessionMembers.Any(m => m.CustomerId == customerId);
    }

    /// <summary>
    /// Get the role of a customer in this session
    /// </summary>
    public SessionMemberRole? GetMemberRole(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            return null;

        // Primary customer is always owner
        if (CustomerId == customerId)
            return SessionMemberRole.Owner;

        return _sessionMembers
            .FirstOrDefault(m => m.CustomerId == customerId)
            ?.Role;
    }

    /// <summary>
    /// Assign a customer to a walk-in session (admin action)
    /// </summary>
    public void AssignCustomer(string customerId, string? customerName)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new SpacesDomainException("Customer ID is required");

        if (Status != ReservationStatus.Active && Status != ReservationStatus.Reserved)
            throw new SpacesDomainException("Can only assign customers to active or reserved sessions");

        if (CustomerId != null)
            throw new SpacesDomainException("Session already has an assigned customer");

        CustomerId = customerId;
        CustomerName = customerName;

        // If session is already active (walk-in), add as Owner session member
        // immediately — and tell them, the way a member who scanned in is told,
        // so their phone shows the running session
        if (Status == ReservationStatus.Active && !_sessionMembers.Any(m => m.CustomerId == customerId))
        {
            _sessionMembers.Add(new SessionMember(Id, customerId, customerName, SessionMemberRole.Owner));
            AddDomainEvent(new SessionMemberJoinedDomainEvent(this, customerId));
        }

        // Every screen showing this room has a name to put on it now
        AddDomainEvent(new SessionCustomerAssignedDomainEvent(this, customerId));
    }
}
