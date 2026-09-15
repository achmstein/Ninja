#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

/// <summary>
/// A size factor: when the option is chosen, every scalable slot of the
/// recipe is multiplied by it (دبل ×2, Large ×1.5). One per option; the
/// factors of several chosen options multiply.
/// </summary>
public class RecipeScale
{
    public const decimal MaxFactor = 20m;

    public int OptionId { get; private set; }

    public decimal Factor { get; private set; }

    protected RecipeScale() { }

    public RecipeScale(int optionId, decimal factor)
    {
        if (optionId <= 0)
            throw new InventoryDomainException("A size factor needs the option it applies to.");

        if (factor <= 0 || factor > MaxFactor)
            throw new InventoryDomainException($"A size factor is between 0 and {MaxFactor}.");

        OptionId = optionId;
        Factor = factor;
    }
}
