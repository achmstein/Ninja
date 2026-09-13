#nullable enable
namespace Chillax.Finance.Domain.AggregatesModel.ExpenseAggregate;

/// <summary>
/// What an expense was for, as the owner groups them: rent, electricity,
/// gas, repairs… A short editable list; totals by category month over
/// month are what make "electricity doubled" visible.
/// </summary>
public class ExpenseCategory : Entity, IAggregateRoot
{
    public LocalizedText Name { get; private set; } = new();

    public int DisplayOrder { get; private set; }

    public bool IsActive { get; private set; } = true;

    protected ExpenseCategory() { }

    public ExpenseCategory(LocalizedText name, int displayOrder)
    {
        Update(name, displayOrder, true);
    }

    public void Update(LocalizedText name, int displayOrder, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(name.En) && string.IsNullOrWhiteSpace(name.Ar))
            throw new FinanceDomainException("A category needs a name.");

        Name = name;
        DisplayOrder = displayOrder;
        IsActive = isActive;
    }
}
