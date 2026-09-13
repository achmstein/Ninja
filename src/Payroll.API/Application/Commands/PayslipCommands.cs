#nullable enable
using Chillax.Payroll.API.Application.IntegrationEvents.Events;
using Chillax.Payroll.API.Application.Services;
using Chillax.Payroll.Infrastructure.Idempotency;

namespace Chillax.Payroll.API.Application.Commands;

/// <summary>
/// Generate the period's payslip for one employee, or for everyone employed
/// at the branch during the period when <paramref name="EmployeeId"/> is
/// null. A draft already there is regenerated; a paid one is left alone.
/// Answers the ids touched.
/// </summary>
public record GeneratePayslipsCommand(int BranchId, int? EmployeeId, DateOnly PeriodStart, DateOnly PeriodEnd, string GeneratedBy) : IRequest<IReadOnlyList<int>>;

public class GeneratePayslipsCommandHandler(
    IEmployeeRepository employees,
    IPayslipGenerator generator) : IRequestHandler<GeneratePayslipsCommand, IReadOnlyList<int>>
{
    public async Task<IReadOnlyList<int>> Handle(GeneratePayslipsCommand command, CancellationToken cancellationToken)
    {
        if (command.PeriodEnd < command.PeriodStart)
            throw new PayrollDomainException("A pay period cannot end before it starts.");

        List<Employee> people;

        if (command.EmployeeId is { } one)
        {
            var employee = await employees.GetAsync(one)
                ?? throw new PayrollDomainException("Employee not found.");
            people = [employee];
        }
        else
        {
            people = await employees.GetAtBranchDuringAsync(command.BranchId, command.PeriodStart, command.PeriodEnd);
        }

        var ids = new List<int>();

        foreach (var employee in people)
        {
            // Asked for by name, a paid period is an error; sweeping the
            // branch, it is simply left alone
            var payslip = await generator.GenerateAsync(employee, command.BranchId, command.PeriodStart, command.PeriodEnd,
                command.GeneratedBy, throwIfPaid: command.EmployeeId is not null);

            if (payslip is not null)
                ids.Add(payslip.Id);
        }

        return ids;
    }
}

/// <summary>A retried generate answers an empty list: the first attempt made them, the list shows them.</summary>
public class GeneratePayslipsIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<GeneratePayslipsCommand, IReadOnlyList<int>>> logger)
    : IdentifiedCommandHandler<GeneratePayslipsCommand, IReadOnlyList<int>>(mediator, requestManager, logger)
{
    protected override Task<IReadOnlyList<int>> CreateResultForDuplicateRequestAsync(GeneratePayslipsCommand command, CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<int>>([]);
}

/// <summary>
/// Hand the money over: a Payment line for what was actually paid and the
/// payslip frozen. The default is what the person is owed <em>now</em>,
/// not the figure frozen at generation — a wage the till paid out since
/// then is already on the ledger, and must not be paid twice. Zero is
/// fine: the till paid it all, the payslip is just closed.
/// </summary>
public record PayPayslipCommand(int PayslipId, decimal? Amount, string? Note, string PaidBy) : IRequest<bool>;

public class PayPayslipCommandHandler(
    IPayslipRepository payslips,
    ILedgerRepository ledger) : IRequestHandler<PayPayslipCommand, bool>
{
    public async Task<bool> Handle(PayPayslipCommand command, CancellationToken cancellationToken)
    {
        var payslip = await payslips.GetAsync(command.PayslipId)
            ?? throw new PayrollDomainException("Payslip not found.");

        var owed = (await ledger.GetForEmployeeAsync(payslip.EmployeeId)).Sum(l => l.Signed);
        var amount = command.Amount ?? Math.Max(0, owed);

        payslip.Pay(amount, command.Note, command.PaidBy);

        if (amount > 0)
        {
            ledger.Add(new LedgerEntry(payslip.EmployeeId, LedgerEntryType.Payment, amount, DateOnly.FromDateTime(DateTime.UtcNow),
                command.Note ?? $"{payslip.PeriodStart:yyyy-MM-dd} – {payslip.PeriodEnd:yyyy-MM-dd}", command.PaidBy,
                LedgerSource.Payslip, $"{payslip.Reference}:payment"));
        }

        await payslips.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>A retried pay answers true: the first attempt paid it, the payslip shows it.</summary>
public class PayPayslipIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<PayPayslipCommand, bool>> logger)
    : IdentifiedCommandHandler<PayPayslipCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(PayPayslipCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}

/// <summary>Drop a draft and the Earned line it posted. A paid payslip stays.</summary>
public record DeletePayslipCommand(int PayslipId) : IRequest<bool>;

public class DeletePayslipCommandHandler(
    IPayslipRepository payslips,
    ILedgerRepository ledger,
    IPayrollIntegrationEventService integrationEvents) : IRequestHandler<DeletePayslipCommand, bool>
{
    public async Task<bool> Handle(DeletePayslipCommand command, CancellationToken cancellationToken)
    {
        var payslip = await payslips.GetAsync(command.PayslipId);
        if (payslip is null)
            return false;

        if (payslip.IsPaid)
            throw new PayrollDomainException("A paid payslip cannot be deleted.");

        var earned = await ledger.FindByReferenceAsync(payslip.Reference);
        if (earned is not null)
            ledger.Remove(earned);

        payslips.Remove(payslip);
        await payslips.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // The period cost nothing until it is generated again
        await integrationEvents.AddAndSaveEventAsync(new EmployeeEarningsChangedIntegrationEvent(
            payslip.BranchId, payslip.EmployeeId, payslip.PeriodStart, payslip.PeriodEnd, 0));

        return true;
    }
}
