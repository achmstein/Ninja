#nullable enable
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Infrastructure.Idempotency;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.API.Application.Commands;

public record OpenShiftCommand(int BranchId, decimal OpeningFloat, string OpenedBy, string? OpenedByUserId = null) : IRequest<int>;

public class OpenShiftCommandHandler(
    IShiftRepository shiftRepository,
    ILogger<OpenShiftCommandHandler> logger) : IRequestHandler<OpenShiftCommand, int>
{
    public async Task<int> Handle(OpenShiftCommand command, CancellationToken cancellationToken)
    {
        // The partial unique index backs this up against a race
        var open = await shiftRepository.FindOpenByBranchAsync(command.BranchId);
        if (open is not null)
            throw new SalesDomainException($"Branch {command.BranchId} already has an open shift (#{open.Id}). Close it first.");

        var shift = shiftRepository.Add(new Shift(command.BranchId, command.OpeningFloat, command.OpenedBy, command.OpenedByUserId));

        await shiftRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Shift {ShiftId} opened for branch {BranchId} by {OpenedBy} with float {Float}",
            shift.Id, command.BranchId, command.OpenedBy, command.OpeningFloat);

        return shift.Id;
    }
}


/// <summary>Idempotent wrapper for <see cref="OpenShiftCommand"/> keyed on the client's request id.</summary>
public class OpenShiftIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    IShiftQueries queries, ILogger<IdentifiedCommandHandler<OpenShiftCommand, int>> logger)
    : IdentifiedCommandHandler<OpenShiftCommand, int>(mediator, requestManager, logger)
{
    // The branch's open drawer is the one the first attempt opened
    protected override async Task<int> CreateResultForDuplicateRequestAsync(OpenShiftCommand command, CancellationToken cancellationToken)
        => (await queries.GetCurrentShiftAsync(command.BranchId))?.Id ?? 0;
}
