using Chillax.Spaces.Domain.Events;

namespace Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;

/// <summary>
/// A spot a party occupies: a room, a table, a station. One QR per place
/// (its id). What it can do follows from its data — a tariff makes it timed
/// and reservable — not from its kind, so a table with a tariff runs a
/// timer exactly like a room.
/// </summary>
public class Place : Entity, IAggregateRoot
{
    public PlaceKind Kind { get; private set; }
    public LocalizedText Name { get; private set; } = new();
    public LocalizedText? Description { get; private set; }
    public int BranchId { get; private set; }
    public PlaceStatus PhysicalStatus { get; private set; }

    /// <summary>Takes customers. A deactivated place keeps its printed QR but refuses orders and holds.</summary>
    public bool IsActive { get; private set; } = true;

    /// <summary>How time here is charged; null for a place that only receives orders.</summary>
    public Tariff? Tariff { get; private set; }

    /// <summary>The id a printed room sticker carries (/room/{id}); null for places that were never rooms.</summary>
    public int? LegacyRoomId { get; private set; }

    /// <summary>The id a printed table sticker carries (/table/{id}); null for places that were never tables.</summary>
    public int? LegacyTableId { get; private set; }

    // ---- capabilities: derived, never stored
    public bool IsTimed => Tariff is not null;
    public bool HasOptions => Tariff?.HasOptions == true;
    public bool CanReserve => IsTimed && IsActive;
    public bool TakesControllerRequests => Kind == PlaceKind.Room;

    protected Place() { }

    public Place(PlaceKind kind, LocalizedText name, int branchId, Tariff? tariff = null, LocalizedText? description = null) : this()
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Place name is required");
        Kind = kind;
        Name = name;
        Description = description;
        BranchId = branchId;
        Tariff = tariff;
        PhysicalStatus = PlaceStatus.Available;
        IsActive = true;

        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    /// <summary>A PlayStation room, as the seed and the old API create them.</summary>
    public static Place Room(LocalizedText name, decimal singleRate, decimal multiRate, int branchId, LocalizedText? description = null)
        => new(PlaceKind.Room, name, branchId, Tariff.Room(singleRate, multiRate), description);

    /// <summary>A café table that only receives orders.</summary>
    public static Place Table(LocalizedText name, int branchId)
        => new(PlaceKind.Table, name, branchId);

    public void UpdateDetails(LocalizedText name, LocalizedText? description)
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Place name is required");
        Name = name;
        Description = description;
        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    /// <summary>
    /// Give, change or take away the tariff. Taking it away is refused while
    /// a stay may be running here — the caller checks the stays first.
    /// </summary>
    public void SetTariff(Tariff? tariff)
    {
        if (tariff is null && PhysicalStatus == PlaceStatus.Occupied)
            throw new SpacesDomainException("End the running stay before removing the tariff");
        Tariff = tariff;
        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    public void SetActive(bool isActive)
    {
        if (IsActive == isActive) return;
        IsActive = isActive;
        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    public void SetOccupied()
    {
        if (PhysicalStatus == PlaceStatus.OutOfService)
            throw new SpacesDomainException("This place is out of service");
        PhysicalStatus = PlaceStatus.Occupied;
    }

    public void SetAvailable() => PhysicalStatus = PlaceStatus.Available;

    public void SetOutOfService()
    {
        if (PhysicalStatus == PlaceStatus.Occupied)
            throw new SpacesDomainException("End the running stay before taking the place out of service");
        PhysicalStatus = PlaceStatus.OutOfService;
    }

    public bool IsPhysicallyAvailable() => PhysicalStatus == PlaceStatus.Available;

    /// <summary>Remembered at migration time so printed stickers keep resolving.</summary>
    public void RememberLegacyIds(int? roomId, int? tableId)
    {
        LegacyRoomId = roomId;
        LegacyTableId = tableId;
    }
}
