#nullable enable
using Ninja.Payroll.API.Application.IntegrationEvents.Events;
using Ninja.Payroll.API.Application.Services;
using Ninja.Payroll.Infrastructure.Idempotency;

namespace Ninja.Payroll.API.Application.Commands;

/// <summary>Add someone to the register, with the terms they start on.</summary>
public record HireEmployeeCommand(
    string Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    DateOnly StartedOn,
    PayScheme Scheme,
    decimal Rate,
    int PaidDaysOff = Employee.DefaultPaidDaysOff) : IRequest<int>;

public class HireEmployeeCommandHandler(
    IEmployeeRepository employees,
    IPayslipGenerator generator) : IRequestHandler<HireEmployeeCommand, int>
{
    public async Task<int> Handle(HireEmployeeCommand command, CancellationToken cancellationToken)
    {
        await EmployeeCommands.EnsureLoginFreeAsync(employees, command.UserId, null);

        var employee = employees.Add(Employee.Hire(
            command.Name, command.JobTitle, command.Phone, command.BranchId, command.UserId,
            command.StartedOn, command.Scheme, command.Rate, command.PaidDaysOff));

        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // The account shows this month's pay from day one (a salary at
        // once, a daily wage as days are marked)
        await generator.RefreshCurrentAsync([employee], EmployeeCommands.Today(), "system");
        return employee.Id;
    }
}

/// <summary>A retried hire answers 0: the first attempt made the record, the list shows it.</summary>
public class HireEmployeeIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<HireEmployeeCommand, int>> logger)
    : IdentifiedCommandHandler<HireEmployeeCommand, int>(mediator, requestManager, logger)
{
    protected override Task<int> CreateResultForDuplicateRequestAsync(HireEmployeeCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}

public record UpdateEmployeeCommand(
    int Id,
    string Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    int PaidDaysOff = Employee.DefaultPaidDaysOff,
    // A start date keyed in wrong, put right; null leaves it as it is
    DateOnly? StartedOn = null) : IRequest<bool>;

public class UpdateEmployeeCommandHandler(
    IEmployeeRepository employees,
    IPayslipRepository payslips,
    IPayslipGenerator generator,
    IMediator mediator) : IRequestHandler<UpdateEmployeeCommand, bool>
{
    public async Task<bool> Handle(UpdateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.Id)
            ?? throw new PayrollDomainException("Employee not found.");

        await EmployeeCommands.EnsureLoginFreeAsync(employees, command.UserId, command.Id);

        employee.Update(command.Name, command.JobTitle, command.Phone, command.BranchId, command.UserId, command.PaidDaysOff);

        var startedBefore = employee.StartedOn;
        var startMoved = command.StartedOn is { } startedOn && employee.CorrectStart(startedOn);

        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        if (startMoved)
            await RedoPayslipsAsync(employee, startedBefore, cancellationToken);

        return true;
    }

    /// <summary>
    /// The months between the old start and the new one are worth something
    /// else now: their drafts are worked out again, and a draft for a month
    /// the person turns out not to have worked in goes. Paid months stay.
    /// </summary>
    private async Task RedoPayslipsAsync(Employee employee, DateOnly startedBefore, CancellationToken cancellationToken)
    {
        var today = EmployeeCommands.Today();
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        var from = startedBefore < employee.StartedOn ? startedBefore : employee.StartedOn;
        var to = startedBefore < employee.StartedOn ? employee.StartedOn : startedBefore;

        var months = new SortedSet<DateOnly> { thisMonth };
        for (var month = new DateOnly(from.Year, from.Month, 1); month <= to; month = month.AddMonths(1))
            months.Add(month);

        foreach (var month in months)
        {
            var draft = await payslips.FindAsync(employee.Id, month);

            // A month never generated stays that way, as after a hire: only this month is made
            if (draft is null && month != thisMonth)
                continue;

            if (employee.DaysEmployed(month, month.AddMonths(1).AddDays(-1)) == 0)
            {
                if (draft is { IsPaid: false })
                    await mediator.Send(new DeletePayslipCommand(draft.Id), cancellationToken);
                continue;
            }

            await generator.RefreshCurrentAsync([employee], month, "system");
        }
    }
}

/// <summary>New pay from a date; the same date replaces, earlier dates stay as history.</summary>
public record SetPayTermsCommand(int EmployeeId, PayScheme Scheme, decimal Rate, DateOnly EffectiveFrom) : IRequest<bool>;

public class SetPayTermsCommandHandler(
    IEmployeeRepository employees,
    IPayslipGenerator generator) : IRequestHandler<SetPayTermsCommand, bool>
{
    public async Task<bool> Handle(SetPayTermsCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.EmployeeId)
            ?? throw new PayrollDomainException("Employee not found.");

        employee.SetPayTerms(command.Scheme, command.Rate, command.EffectiveFrom);
        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // New pay changes what the month it starts in is worth, and this one
        await generator.RefreshCurrentAsync([employee], command.EffectiveFrom, "system");
        if (command.EffectiveFrom.Month != EmployeeCommands.Today().Month || command.EffectiveFrom.Year != EmployeeCommands.Today().Year)
            await generator.RefreshCurrentAsync([employee], EmployeeCommands.Today(), "system");
        return true;
    }
}

public record LeaveCommand(int EmployeeId, DateOnly EndedOn) : IRequest<bool>;

public class LeaveCommandHandler(IEmployeeRepository employees) : IRequestHandler<LeaveCommand, bool>
{
    public async Task<bool> Handle(LeaveCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.EmployeeId)
            ?? throw new PayrollDomainException("Employee not found.");

        employee.Leave(command.EndedOn);
        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

public record RehireCommand(int EmployeeId, DateOnly StartedOn) : IRequest<bool>;

public class RehireCommandHandler(IEmployeeRepository employees) : IRequestHandler<RehireCommand, bool>
{
    public async Task<bool> Handle(RehireCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.EmployeeId)
            ?? throw new PayrollDomainException("Employee not found.");

        employee.Rehire(command.StartedOn);
        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>
/// Someone added to the register by mistake, or who never started: gone
/// for good, with what the system made for them on its own (the drafts of
/// their pay and the days marked). Anyone money has moved for (a payslip
/// paid, an advance, a bonus, a pay-out at the till) stays on the books and
/// is marked as left instead.
/// </summary>
public record DeleteEmployeeCommand(int EmployeeId) : IRequest<bool>;

public class DeleteEmployeeCommandHandler(
    IEmployeeRepository employees,
    IPayslipRepository payslips,
    ILedgerRepository ledger,
    IAttendanceRepository attendance,
    IPayrollIntegrationEventService integrationEvents) : IRequestHandler<DeleteEmployeeCommand, bool>
{
    public async Task<bool> Handle(DeleteEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.EmployeeId);
        if (employee is null)
            return false;

        var slips = await payslips.GetForEmployeeAsync(employee.Id);
        var lines = await ledger.GetForEmployeeAsync(employee.Id);
        if (slips.Any(p => p.IsPaid) || lines.Any(l => l.Source != LedgerSource.Payslip))
            throw new PayrollDomainException("Money has been recorded for this employee, so they stay on the books. Mark them as left instead.");

        foreach (var line in lines)
            ledger.Remove(line);
        foreach (var slip in slips)
            payslips.Remove(slip);
        foreach (var day in await attendance.GetForEmployeeAsync(employee.Id))
            attendance.Remove(day);
        employees.Remove(employee);

        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // Finance counted their drafts as labour: those months cost nothing now
        foreach (var slip in slips)
            await integrationEvents.AddAndSaveEventAsync(new EmployeeEarningsChangedIntegrationEvent(
                slip.BranchId, slip.EmployeeId, slip.PeriodStart, slip.PeriodEnd, 0,
                PayslipId: slip.Id, LabourCost: 0));

        return true;
    }
}

static class EmployeeCommands
{
    /// <summary>The business's day right now, for "this month".</summary>
    public static DateOnly Today() => BusinessDay.Of(DateTime.UtcNow);

    /// <summary>One login belongs to one employee; the unique index is the backstop.</summary>
    public static async Task EnsureLoginFreeAsync(IEmployeeRepository employees, string? userId, int? exceptEmployeeId)
    {
        if (!string.IsNullOrWhiteSpace(userId) && await employees.UserLinkedElsewhereAsync(userId.Trim(), exceptEmployeeId))
            throw new PayrollDomainException("That login is already linked to another employee.");
    }
}
