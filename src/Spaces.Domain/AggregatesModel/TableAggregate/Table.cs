using Chillax.Spaces.Domain.Exceptions;

namespace Chillax.Spaces.Domain.AggregatesModel.TableAggregate;

/// <summary>
/// Table aggregate root - a café table customers sit at to order.
/// Unlike a Room, a table is not time-billed and has no sessions; it only labels
/// orders so staff know where to deliver them.
/// </summary>
public class Table : Entity, IAggregateRoot
{
    public LocalizedText Name { get; private set; } = new();

    /// <summary>
    /// The branch this table belongs to
    /// </summary>
    public int BranchId { get; private set; }

    /// <summary>
    /// Inactive tables stay in the list (so past orders keep their name and the
    /// printed QR can be re-enabled) but are not offered to customers.
    /// </summary>
    public bool IsActive { get; private set; }

    protected Table() { }

    public Table(LocalizedText name, int branchId) : this()
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Table name is required");

        Name = name;
        BranchId = branchId;
        IsActive = true;
    }

    public Table(string name, int branchId, string? nameAr = null)
        : this(new LocalizedText(name, nameAr), branchId)
    {
    }

    /// <summary>
    /// Rename the table. Orders already placed keep the name they were given.
    /// </summary>
    public void Rename(LocalizedText name)
    {
        if (string.IsNullOrWhiteSpace(name.En))
            throw new SpacesDomainException("Table name is required");

        Name = name;
    }

    public void SetActive(bool isActive)
    {
        IsActive = isActive;
    }
}
