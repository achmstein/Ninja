#nullable enable
using Ninja.Inventory.API.Application.Services;
using Ninja.Inventory.Domain.AggregatesModel.TransferAggregate;
using Ninja.Inventory.Infrastructure.Idempotency;

namespace Ninja.Inventory.API.Application.Commands;

public record TransferLineInput(int StockItemId, decimal Quantity);

/// <summary>
/// Move stock between branches. Leaves the source at its average cost and
/// arrives at the destination at that cost, in one transaction, so both
/// ledgers and both menus react at once.
/// </summary>
public record TransferStockCommand(
    int FromBranchId,
    int ToBranchId,
    string? Note,
    IReadOnlyList<TransferLineInput> Lines,
    string SentBy) : IRequest<int>;

public class TransferStockCommandHandler(
    IStockItemRepository stockItems,
    ITransferRepository transfers,
    IStockPostingService posting) : IRequestHandler<TransferStockCommand, int>
{
    public async Task<int> Handle(TransferStockCommand command, CancellationToken cancellationToken)
    {
        await StockItemsMustExist.CheckAsync(stockItems, command.Lines.Select(l => l.StockItemId));

        var transfer = transfers.Add(Transfer.Send(
            command.FromBranchId,
            command.ToBranchId,
            command.Note,
            command.Lines.Select(l => new TransferLine(l.StockItemId, l.Quantity)),
            command.SentBy));

        await transfers.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        var reference = $"transfer:{transfer.Id}";

        // Out first: what left the source, and at what average, is what arrives
        var left = await posting.PostAsync(
            command.FromBranchId,
            transfer.Lines.Select(l => new MovementDraft(l.StockItemId, MovementType.TransferOut, -l.Quantity, reference, transfer.Note)).ToList(),
            command.SentBy);

        var costs = left.ToDictionary(c => c.StockItemId, c => c.AvgUnitCost);

        await posting.PostAsync(
            command.ToBranchId,
            transfer.Lines.Select(l => new MovementDraft(
                l.StockItemId, MovementType.TransferIn, l.Quantity, reference, transfer.Note,
                UnitCost: costs.GetValueOrDefault(l.StockItemId))).ToList(),
            command.SentBy);

        await transfers.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return transfer.Id;
    }
}

public class TransferStockIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<TransferStockCommand, int>> logger)
    : IdentifiedCommandHandler<TransferStockCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(TransferStockCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

/// <summary>Recompute the branch's levels from its ledger. Returns how many changed.</summary>
public record RebuildLevelsCommand(int BranchId) : IRequest<int>;

public class RebuildLevelsCommandHandler(IStockLedger ledger, ILogger<RebuildLevelsCommandHandler> logger)
    : IRequestHandler<RebuildLevelsCommand, int>
{
    public async Task<int> Handle(RebuildLevelsCommand command, CancellationToken cancellationToken)
    {
        var changed = await ledger.RebuildAsync(command.BranchId);
        logger.LogInformation("Branch {BranchId}: rebuilt levels from the ledger, {Changed} corrected", command.BranchId, changed);
        return changed;
    }
}
