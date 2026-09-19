#nullable enable
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.API.Application.Services;
using Ninja.Inventory.Infrastructure.Idempotency;

namespace Ninja.Inventory.API.Application.Commands;

public record PurchaseLineInput(int StockItemId, decimal Quantity, decimal UnitCost);

/// <summary>Stock received into a branch, posted as one receipt and its movements.</summary>
public record ReceivePurchaseCommand(
    int BranchId,
    string? Supplier,
    string? InvoiceRef,
    IReadOnlyList<PurchaseLineInput> Lines,
    string ReceivedBy,
    int? SupplierId = null) : IRequest<int>;

public class ReceivePurchaseCommandHandler(
    IStockItemRepository stockItems,
    IPurchaseRepository purchases,
    IStockPostingService posting,
    IInventoryIntegrationEventService integrationEvents) : IRequestHandler<ReceivePurchaseCommand, int>
{
    public async Task<int> Handle(ReceivePurchaseCommand command, CancellationToken cancellationToken)
    {
        await StockItemsMustExist.CheckAsync(stockItems, command.Lines.Select(l => l.StockItemId));

        var purchase = purchases.Add(Purchase.Receive(
            command.BranchId,
            command.Supplier,
            command.InvoiceRef,
            command.Lines.Select(l => new PurchaseLine(l.StockItemId, l.Quantity, l.UnitCost)),
            command.ReceivedBy,
            command.SupplierId));

        // Saved first so the receipt has its number for the movements' reference
        await purchases.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        var reference = $"purchase:{purchase.Id}";

        await posting.PostAsync(
            command.BranchId,
            purchase.Lines.Select(l => new MovementDraft(l.StockItemId, MovementType.Purchase, l.Quantity, reference, UnitCost: l.UnitCost)).ToList(),
            command.ReceivedBy);

        await purchases.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // Finance hears of the delivery through the outbox: who is owed for it
        await integrationEvents.AddAndSaveEventAsync(new PurchaseReceivedIntegrationEvent(
            purchase.Id, purchase.BranchId, purchase.SupplierId, purchase.Supplier, purchase.InvoiceRef,
            purchase.Total, purchase.ReceivedAt, purchase.ReceivedBy));

        return purchase.Id;
    }
}

public class ReceivePurchaseIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<ReceivePurchaseCommand, int>> logger)
    : IdentifiedCommandHandler<ReceivePurchaseCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(ReceivePurchaseCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

public record StockCountLineInput(int StockItemId, decimal Counted);

/// <summary>
/// A physical count at a branch. What the ledger expected is read here, at
/// posting time, and frozen on each line; the differences become Count
/// movements that bring the ledger to what was found.
/// </summary>
public record PostStockCountCommand(
    int BranchId,
    string? Note,
    IReadOnlyList<StockCountLineInput> Lines,
    string CountedBy) : IRequest<int>;

public class PostStockCountCommandHandler(
    IStockItemRepository stockItems,
    IStockCountRepository counts,
    IStockLedger ledger,
    IStockPostingService posting) : IRequestHandler<PostStockCountCommand, int>
{
    public async Task<int> Handle(PostStockCountCommand command, CancellationToken cancellationToken)
    {
        await StockItemsMustExist.CheckAsync(stockItems, command.Lines.Select(l => l.StockItemId));

        var expected = await ledger.GetOnHandAsync(command.BranchId, command.Lines.Select(l => l.StockItemId));

        var count = counts.Add(StockCount.Post(
            command.BranchId,
            command.Note,
            command.Lines.Select(l => new StockCountLine(l.StockItemId, expected[l.StockItemId], l.Counted)),
            command.CountedBy));

        await counts.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        var reference = $"count:{count.Id}";

        var drafts = count.Differences
            // No reason text: the type says it, and the reference names the count
            .Select(l => new MovementDraft(l.StockItemId, MovementType.Count, l.Variance, reference))
            .ToList();

        if (drafts.Count > 0)
        {
            await posting.PostAsync(command.BranchId, drafts, command.CountedBy);
            await counts.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        }

        return count.Id;
    }
}

public class PostStockCountIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PostStockCountCommand, int>> logger)
    : IdentifiedCommandHandler<PostStockCountCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(PostStockCountCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

/// <summary>
/// One movement by hand: waste (always out), or an adjustment in either
/// direction with a reason: opening stock (with what it cost), a return to
/// the shelf, a keying error.
/// </summary>
public record PostAdjustmentCommand(
    int BranchId,
    int StockItemId,
    MovementType Type,
    decimal Quantity,
    string Reason,
    decimal? UnitCost,
    string RecordedBy) : IRequest<bool>;

public class PostAdjustmentCommandHandler(
    IStockItemRepository stockItems,
    IStockPostingService posting) : IRequestHandler<PostAdjustmentCommand, bool>
{
    public async Task<bool> Handle(PostAdjustmentCommand command, CancellationToken cancellationToken)
    {
        if (command.Type is not (MovementType.Waste or MovementType.Adjustment))
            throw new InventoryDomainException("Only waste and adjustments are posted by hand.");

        if (string.IsNullOrWhiteSpace(command.Reason))
            throw new InventoryDomainException("A reason is required.");

        if (command.Quantity == 0)
            throw new InventoryDomainException("A movement moves something.");

        await StockItemsMustExist.CheckAsync(stockItems, [command.StockItemId]);

        // Waste only ever goes out, whichever sign was keyed
        var quantity = command.Type == MovementType.Waste ? -Math.Abs(command.Quantity) : command.Quantity;

        await posting.PostAsync(
            command.BranchId,
            [new MovementDraft(command.StockItemId, command.Type, quantity, null, command.Reason, command.UnitCost)],
            command.RecordedBy);

        await stockItems.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

public class PostAdjustmentIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PostAdjustmentCommand, bool>> logger)
    : IdentifiedCommandHandler<PostAdjustmentCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(PostAdjustmentCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}

static class StockItemsMustExist
{
    public static async Task CheckAsync(IStockItemRepository stockItems, IEnumerable<int> ids)
    {
        var wanted = ids.Distinct().ToList();
        var known = await stockItems.GetManyAsync(wanted);

        if (known.Count != wanted.Count)
            throw new InventoryDomainException("A line names a stock item that does not exist.");
    }
}
