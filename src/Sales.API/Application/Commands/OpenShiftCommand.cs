#nullable enable
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.API.Application.Commands;

public record OpenShiftCommand(int BranchId, decimal OpeningFloat, string OpenedBy) : IRequest<int>;

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

        var shift = shiftRepository.Add(new Shift(command.BranchId, command.OpeningFloat, command.OpenedBy));

        await shiftRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Shift {ShiftId} opened for branch {BranchId} by {OpenedBy} with float {Float}",
            shift.Id, command.BranchId, command.OpenedBy, command.OpeningFloat);

        return shift.Id;
    }
}
