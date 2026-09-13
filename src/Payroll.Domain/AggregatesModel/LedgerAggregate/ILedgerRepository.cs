#nullable enable
namespace Chillax.Payroll.Domain.AggregatesModel.LedgerAggregate;

public interface ILedgerRepository : IRepository<LedgerEntry>
{
    LedgerEntry Add(LedgerEntry entry);

    Task<List<LedgerEntry>> GetForEmployeeAsync(int employeeId);

    Task<LedgerEntry?> FindByReferenceAsync(string reference);

    void Remove(LedgerEntry entry);
}
