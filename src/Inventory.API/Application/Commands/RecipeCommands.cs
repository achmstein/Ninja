#nullable enable
using Chillax.Inventory.Infrastructure.Idempotency;

namespace Chillax.Inventory.API.Application.Commands;

/// <summary>
/// The one-tap way to track a menu item sold as-is (a can, a bottle, a
/// slice): a stock item named after it, counted in pieces, selling the menu
/// item out when it runs dry, and a recipe of one each.
/// </summary>
public record TrackByUnitCommand(int CatalogItemId, LocalizedText Name) : IRequest<int>;

public class TrackByUnitCommandHandler(
    IStockItemRepository stockItems,
    IRecipeRepository recipes) : IRequestHandler<TrackByUnitCommand, int>
{
    public async Task<int> Handle(TrackByUnitCommand command, CancellationToken cancellationToken)
    {
        if (await recipes.GetAsync(command.CatalogItemId) is not null)
            throw new InventoryDomainException("This menu item already has a recipe.");

        var item = stockItems.Add(StockItem.Create(command.Name, "pcs", null, null, autoSoldOut: true));
        await stockItems.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        recipes.Add(Recipe.ForUnit(command.CatalogItemId, item.Id));
        await recipes.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return item.Id;
    }
}

public class TrackByUnitIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<TrackByUnitCommand, int>> logger)
    : IdentifiedCommandHandler<TrackByUnitCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(TrackByUnitCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

/// <summary>
/// A line. <paramref name="OptionIds"/> empty or omitted is the slot's
/// default; <paramref name="Slot"/> 0 makes the line a slot of its own (a
/// plain list of ingredients); <paramref name="None"/> is an override that
/// deducts nothing for its options.
/// </summary>
public record RecipeLineInput(int StockItemId, decimal Quantity, List<int>? OptionIds = null, int Slot = 0, bool Scalable = true, bool None = false);

/// <summary>A size factor on an option: the scalable slots are multiplied by it when the option is chosen.</summary>
public record RecipeScaleInput(int OptionId, decimal Factor);

/// <summary>Replace a menu item's recipe (creating it if the item was untracked).</summary>
public record SetRecipeCommand(int CatalogItemId, IReadOnlyList<RecipeLineInput> Lines, IReadOnlyList<RecipeScaleInput>? Scales = null) : IRequest<bool>;

public class SetRecipeCommandHandler(
    IStockItemRepository stockItems,
    IRecipeRepository recipes) : IRequestHandler<SetRecipeCommand, bool>
{
    public async Task<bool> Handle(SetRecipeCommand command, CancellationToken cancellationToken)
    {
        var known = await stockItems.GetManyAsync(command.Lines.Select(l => l.StockItemId));
        var missing = command.Lines.Select(l => l.StockItemId).Except(known.Select(s => s.Id)).ToList();

        if (missing.Count > 0)
            throw new InventoryDomainException("A recipe line names a stock item that does not exist.");

        var lines = command.Lines.Select(l => l.None
            ? RecipeLine.None(l.Slot, l.StockItemId, l.OptionIds ?? [])
            : new RecipeLine(l.StockItemId, l.Quantity, l.OptionIds, l.Slot, l.Scalable)).ToList();
        var scales = (command.Scales ?? []).Select(s => new RecipeScale(s.OptionId, s.Factor)).ToList();

        var recipe = await recipes.GetAsync(command.CatalogItemId);

        if (recipe is null)
            recipes.Add(new Recipe(command.CatalogItemId, lines, scales));
        else
            recipe.SetLines(lines, scales);

        await recipes.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>Stop tracking a menu item. Its stock items and their history stay.</summary>
public record RemoveRecipeCommand(int CatalogItemId) : IRequest<bool>;

public class RemoveRecipeCommandHandler(IRecipeRepository recipes) : IRequestHandler<RemoveRecipeCommand, bool>
{
    public async Task<bool> Handle(RemoveRecipeCommand command, CancellationToken cancellationToken)
    {
        var recipe = await recipes.GetAsync(command.CatalogItemId);

        if (recipe is null)
            return false;

        recipes.Remove(recipe);
        await recipes.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}
