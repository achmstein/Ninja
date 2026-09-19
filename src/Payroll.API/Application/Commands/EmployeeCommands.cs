#nullable enable
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
    int PaidDaysOff = Employee.DefaultPaidDaysOff) : IRequest<bool>;

public class UpdateEmployeeCommandHandler(IEmployeeRepository employees) : IRequestHandler<UpdateEmployeeCommand, bool>
{
    public async Task<bool> Handle(UpdateEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await employees.GetAsync(command.Id)
            ?? throw new PayrollDomainException("Employee not found.");

        await EmployeeCommands.EnsureLoginFreeAsync(employees, command.UserId, command.Id);

        employee.Update(command.Name, command.JobTitle, command.Phone, command.BranchId, command.UserId, command.PaidDaysOff);
        await employees.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
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

static class EmployeeCommands
{
    /// <summary>The café's day right now, for "this month".</summary>
    public static DateOnly Today() => BusinessDay.Of(DateTime.UtcNow);

    /// <summary>One login belongs to one employee; the unique index is the backstop.</summary>
    public static async Task EnsureLoginFreeAsync(IEmployeeRepository employees, string? userId, int? exceptEmployeeId)
    {
        if (!string.IsNullOrWhiteSpace(userId) && await employees.UserLinkedElsewhereAsync(userId.Trim(), exceptEmployeeId))
            throw new PayrollDomainException("That login is already linked to another employee.");
    }
}
