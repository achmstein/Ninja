#nullable enable
using Chillax.Sales.API.Application.Queries;
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.API.Application.Commands;

public record CloseShiftCommand(int ShiftId, decimal ClosingCount, string ClosedBy) : IRequest<ShiftView>;

public class CloseShiftCommandHandler(
    IShiftRepository shiftRepository,
    IShiftQueries shiftQueries,
    ILogger<CloseShiftCommandHandler> logger) : IRequestHandler<CloseShiftCommand, ShiftView>
{
    public async Task<ShiftView> Handle(CloseShiftCommand command, CancellationToken cancellationToken)
    {
        var shift = await shiftRepository.GetAsync(command.ShiftId)
            ?? throw new SalesDomainException($"Shift {command.ShiftId} does not exist.");

        // The tickets stamped with this shift hold the cash figures; the
        // aggregate turns them into the expectation and the verdict
        var cash = await shiftQueries.GetShiftCashAsync(shift.Id);

        shift.Close(command.ClosingCount, cash.CashPayments, cash.ChangeGiven, command.ClosedBy);

        await shiftRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Shift {ShiftId} closed by {ClosedBy}: expected {Expected}, counted {Counted}, over/short {OverShort}",
            shift.Id, command.ClosedBy, shift.ExpectedCash, shift.ClosingCount, shift.OverShort);

        // The Z report, fresh off the close
        return (await shiftQueries.GetShiftAsync(shift.Id))!;
    }
}
