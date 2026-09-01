using Chillax.Spaces.Domain.Exceptions;

namespace Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;

/// <summary>
/// Room aggregate root - manages physical room state
/// Availability is computed at query time by checking both physical status and reservation conflicts
/// </summary>
public class Room : Entity, IAggregateRoot
{
    public LocalizedText Name { get; private set; } = new();
    public LocalizedText? Description { get; private set; }
    public decimal SingleRate { get; private set; }
    public decimal MultiRate { get; private set; }

    /// <summary>
    /// The branch this room belongs to
    /// </summary>
    public int BranchId { get; private set; }

    /// <summary>
    /// Physical status of the room (not reservation status)
    /// </summary>
    public RoomPhysicalStatus PhysicalStatus { get; private set; }

    protected Room() { }

    public Room(LocalizedText name, decimal singleRate, decimal multiRate, int branchId, LocalizedText? description = null) : this()
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Room name is required");

        if (singleRate <= 0)
            throw new SpacesDomainException("Single rate must be greater than zero");

        if (multiRate <= 0)
            throw new SpacesDomainException("Multi rate must be greater than zero");

        Name = name;
        SingleRate = singleRate;
        MultiRate = multiRate;
        Description = description;
        BranchId = branchId;
        PhysicalStatus = RoomPhysicalStatus.Available;
    }

    public Room(string name, decimal singleRate, decimal multiRate, int branchId, string? description = null, string? nameAr = null, string? descriptionAr = null)
        : this(new LocalizedText(name, nameAr), singleRate, multiRate, branchId, description != null ? new LocalizedText(description, descriptionAr) : null)
    {
    }

    /// <summary>
    /// Update room details
    /// </summary>
    public void UpdateDetails(LocalizedText name, LocalizedText? description, decimal singleRate, decimal multiRate)
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Room name is required");

        if (singleRate <= 0)
            throw new SpacesDomainException("Single rate must be greater than zero");

        if (multiRate <= 0)
            throw new SpacesDomainException("Multi rate must be greater than zero");

        Name = name;
        Description = description;
        SingleRate = singleRate;
        MultiRate = multiRate;
    }

    /// <summary>
    /// Update room details (string overload for convenience)
    /// </summary>
    public void UpdateDetails(string name, string? description, decimal singleRate, decimal multiRate, string? nameAr = null, string? descriptionAr = null)
    {
        UpdateDetails(
            new LocalizedText(name, nameAr),
            description != null ? new LocalizedText(description, descriptionAr) : null,
            singleRate,
            multiRate
        );
    }

    /// <summary>
    /// Mark room as occupied (when session starts)
    /// </summary>
    public void SetOccupied()
    {
        if (PhysicalStatus == RoomPhysicalStatus.Maintenance)
            throw new SpacesDomainException("Cannot occupy a room under maintenance");

        PhysicalStatus = RoomPhysicalStatus.Occupied;
    }

    /// <summary>
    /// Mark room as available (when session ends)
    /// </summary>
    public void SetAvailable()
    {
        PhysicalStatus = RoomPhysicalStatus.Available;
    }

    /// <summary>
    /// Mark room as under maintenance
    /// </summary>
    public void SetMaintenance()
    {
        if (PhysicalStatus == RoomPhysicalStatus.Occupied)
            throw new SpacesDomainException("Cannot set maintenance on an occupied room. End the session first.");

        PhysicalStatus = RoomPhysicalStatus.Maintenance;
    }

    /// <summary>
    /// Check if room is physically available (not checking reservations)
    /// For full availability check including reservations, use the query service
    /// </summary>
    public bool IsPhysicallyAvailable()
    {
        return PhysicalStatus == RoomPhysicalStatus.Available;
    }
}
