using Ninja.Spaces.Domain.Events;

namespace Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;

/// <summary>
/// A spot a party occupies: a room, a table, a station. One QR per place
/// (its id). What it can do follows from its data, not from its kind: a
/// tariff makes it timed, so a table with a tariff runs a timer exactly
/// like a room; <see cref="Reservable"/> lets it be booked, with or
/// without a clock.
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

    /// <summary>
    /// Takes reservations: a customer can book it ahead or hold it on the
    /// way. On by default for a timed place; a plain table is opted in by
    /// the owner, so a café that only seats people sees no change.
    /// </summary>
    public bool Reservable { get; private set; }

    // ---- capabilities: derived, never stored
    public bool IsTimed => Tariff is not null;
    public bool HasOptions => Tariff?.HasOptions == true;
    public bool CanReserve => Reservable && IsActive;
    public bool TakesControllerRequests => Kind == PlaceKind.Room;

    protected Place() { }

    public Place(PlaceKind kind, LocalizedText name, int branchId, Tariff? tariff = null, LocalizedText? description = null, bool? reservable = null) : this()
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Place name is required");
        Kind = kind;
        Name = name;
        Description = description;
        BranchId = branchId;
        Tariff = tariff;
        Reservable = reservable ?? tariff is not null;
        PhysicalStatus = PlaceStatus.Available;
        IsActive = true;

        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    /// <summary>A PlayStation room, as the seed creates them.</summary>
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
    /// a stay may be running here — the caller checks the stays first. A
    /// place that gets a tariff becomes reservable, as timed places always
    /// were; the owner may switch that off afterwards.
    /// </summary>
    public void SetTariff(Tariff? tariff)
    {
        if (tariff is null && PhysicalStatus == PlaceStatus.Occupied)
            throw new SpacesDomainException("End the running stay before removing the tariff");
        if (tariff is not null && Tariff is null)
            Reservable = true;
        Tariff = tariff;
        AddDomainEvent(new PlaceChangedDomainEvent(this));
    }

    /// <summary>Let customers book this place, or stop that. Open reservations are the caller's to settle.</summary>
    public void SetReservable(bool reservable)
    {
        if (Reservable == reservable) return;
        Reservable = reservable;
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
}
