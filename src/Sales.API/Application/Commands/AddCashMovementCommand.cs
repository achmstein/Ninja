#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Ninja.Sales.API.Application.Commands;

public record AddCashMovementCommand(
    int ShiftId,
    CashMovementType Type,
    decimal Amount,
    string Reason,
    string RecordedBy,
    CashMovementKind Kind = CashMovementKind.Other,
    int? EmployeeId = null,
    string? EmployeeName = null,
    int? SupplierId = null,
    string? SupplierName = null,
    int? PartnerId = null,
    string? PartnerName = null,
    int? CategoryId = null) : IRequest<bool>;

public class AddCashMovementCommandHandler(
    IShiftRepository shiftRepository,
    ILogger<AddCashMovementCommandHandler> logger) : IRequestHandler<AddCashMovementCommand, bool>
{
    public async Task<bool> Handle(AddCashMovementCommand command, CancellationToken cancellationToken)
    {
        var shift = await shiftRepository.GetAsync(command.ShiftId)
            ?? throw new SalesDomainException($"Shift {command.ShiftId} does not exist.");

        shift.AddMovement(command.Type, command.Amount, command.Reason, command.RecordedBy, command.Kind, command.EmployeeId, command.EmployeeName,
            command.SupplierId, command.SupplierName, command.PartnerId, command.PartnerName, command.CategoryId);

        await shiftRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "{Type} of {Amount} on shift {ShiftId} by {By}: {Reason}",
            command.Type, command.Amount, shift.Id, command.RecordedBy, command.Reason);

        return true;
    }
}


/// <summary>Idempotent wrapper for <see cref="AddCashMovementCommand"/> keyed on the client's request id.</summary>
public class AddCashMovementIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<AddCashMovementCommand, bool>> logger)
    : IdentifiedCommandHandler<AddCashMovementCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(AddCashMovementCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}
