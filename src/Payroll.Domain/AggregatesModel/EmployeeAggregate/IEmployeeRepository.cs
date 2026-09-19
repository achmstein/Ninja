#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;

public interface IEmployeeRepository : IRepository<Employee>
{
    Employee Add(Employee employee);

    Task<Employee?> GetAsync(int id);

    Task<List<Employee>> GetManyAsync(IEnumerable<int> ids);

    /// <summary>Everyone listed at a branch who was employed on any day of the period: the leavers get their last payslip.</summary>
    Task<List<Employee>> GetAtBranchDuringAsync(int branchId, DateOnly from, DateOnly to);

    Task<bool> UserLinkedElsewhereAsync(string userId, int? exceptEmployeeId);

    /// <summary>The employee a login belongs to, if any.</summary>
    Task<Employee?> FindByUserIdAsync(string userId);
}
