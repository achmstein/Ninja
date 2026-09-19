#nullable enable
using Ninja.Payroll.API.Application.Services;
using Ninja.Payroll.Infrastructure.Idempotency;

namespace Ninja.Payroll.API.Application.Commands;

/// <summary>
/// A line keyed in by hand: a bonus, a deduction, an advance handed over,
/// or a payment made outside the drawer. Earned lines come only from
/// payslips.
/// </summary>
public record PostLedgerEntryCommand(
    int EmployeeId,
    LedgerEntryType Type,
    decimal Amount,
    DateOnly Date,
    string? Note,
    string RecordedBy) : IRequest<int>;

public class PostLedgerEntryCommandHandler(
    IEmployeeRepository employees,
    ILedgerRepository ledger,
    IPayslipGenerator generator) : IRequestHandler<PostLedgerEntryCommand, int>
{
    public async Task<int> Handle(PostLedgerEntryCommand command, CancellationToken cancellationToken)
    {
        if (command.Type == LedgerEntryType.Earned)
            throw new PayrollDomainException("Earnings come from a payslip, not a manual line.");

        var employee = await employees.GetAsync(command.EmployeeId)
            ?? throw new PayrollDomainException("Employee not found.");

        var entry = ledger.Add(new LedgerEntry(command.EmployeeId, command.Type, command.Amount, command.Date, command.Note, command.RecordedBy));
        await ledger.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // The month's statement lists its advances, bonuses and deductions
        await generator.RefreshCurrentAsync([employee], command.Date, command.RecordedBy);
        return entry.Id;
    }
}

/// <summary>A retried post answers 0: the first attempt made the line, the ledger shows it.</summary>
public class PostLedgerEntryIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PostLedgerEntryCommand, int>> logger)
    : IdentifiedCommandHandler<PostLedgerEntryCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(PostLedgerEntryCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}
