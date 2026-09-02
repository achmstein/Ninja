#nullable enable
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.API.Application.Commands;

public record AddCashMovementCommand(
    int ShiftId,
    CashMovementType Type,
    decimal Amount,
    string Reason,
    string RecordedBy) : IRequest<bool>;

public class AddCashMovementCommandHandler(
    IShiftRepository shiftRepository,
    ILogger<AddCashMovementCommandHandler> logger) : IRequestHandler<AddCashMovementCommand, bool>
{
    public async Task<bool> Handle(AddCashMovementCommand command, CancellationToken cancellationToken)
    {
        var shift = await shiftRepository.GetAsync(command.ShiftId)
            ?? throw new SalesDomainException($"Shift {command.ShiftId} does not exist.");

        shift.AddMovement(command.Type, command.Amount, command.Reason, command.RecordedBy);

        await shiftRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "{Type} of {Amount} on shift {ShiftId} by {By}: {Reason}",
            command.Type, command.Amount, shift.Id, command.RecordedBy, command.Reason);

        return true;
    }
}
