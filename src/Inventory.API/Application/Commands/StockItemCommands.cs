#nullable enable
using Ninja.Inventory.Infrastructure.Idempotency;

namespace Ninja.Inventory.API.Application.Commands;

public record CreateStockItemCommand(
    LocalizedText Name,
    string Unit,
    decimal? PackSize,
    string? PackName,
    bool AutoSoldOut) : IRequest<int>;

public class CreateStockItemCommandHandler(IStockItemRepository stockItems) : IRequestHandler<CreateStockItemCommand, int>
{
    public async Task<int> Handle(CreateStockItemCommand command, CancellationToken cancellationToken)
    {
        var item = stockItems.Add(StockItem.Create(command.Name, command.Unit, command.PackSize, command.PackName, command.AutoSoldOut));
        await stockItems.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return item.Id;
    }
}

/// <summary>A retried create answers 0: the first attempt made the item, the list shows it.</summary>
public class CreateStockItemIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<CreateStockItemCommand, int>> logger)
    : IdentifiedCommandHandler<CreateStockItemCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(CreateStockItemCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

public record UpdateStockItemCommand(
    int Id,
    LocalizedText Name,
    string Unit,
    decimal? PackSize,
    string? PackName,
    bool AutoSoldOut,
    bool IsActive) : IRequest<bool>;

public class UpdateStockItemCommandHandler(IStockItemRepository stockItems) : IRequestHandler<UpdateStockItemCommand, bool>
{
    public async Task<bool> Handle(UpdateStockItemCommand command, CancellationToken cancellationToken)
    {
        var item = await stockItems.GetAsync(command.Id)
            ?? throw new InventoryDomainException("Stock item not found.");

        item.Update(command.Name, command.Unit, command.PackSize, command.PackName, command.AutoSoldOut);
        item.SetActive(command.IsActive);

        await stockItems.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>Where the low-stock line sits for this item at this branch; null turns the warning off.</summary>
public record SetReorderLevelCommand(int BranchId, int StockItemId, decimal? ReorderLevel) : IRequest<bool>;

public class SetReorderLevelCommandHandler(IStockItemRepository stockItems, IStockLedger ledger) : IRequestHandler<SetReorderLevelCommand, bool>
{
    public async Task<bool> Handle(SetReorderLevelCommand command, CancellationToken cancellationToken)
    {
        if (command.ReorderLevel is < 0)
            throw new InventoryDomainException("A reorder level cannot be negative.");

        _ = await stockItems.GetAsync(command.StockItemId)
            ?? throw new InventoryDomainException("Stock item not found.");

        await ledger.SetReorderLevelAsync(command.BranchId, command.StockItemId, command.ReorderLevel);
        return true;
    }
}
