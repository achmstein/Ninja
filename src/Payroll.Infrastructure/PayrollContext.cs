#nullable enable
using Ninja.IntegrationEventLogEF;

namespace Ninja.Payroll.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Payroll.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Payroll.API --context PayrollContext [migration-name]
/// </remarks>
public class PayrollContext : DbContext, IUnitOfWork
{
    public DbSet<Employee> Employees { get; set; }
    public DbSet<PayTerms> PayTerms { get; set; }
    public DbSet<AttendanceDay> Attendance { get; set; }
    public DbSet<LedgerEntry> Ledger { get; set; }
    public DbSet<Payslip> Payslips { get; set; }

    private readonly IMediator? _mediator;
    private IDbContextTransaction? _currentTransaction;

    public PayrollContext(DbContextOptions<PayrollContext> options, IMediator? mediator = null) : base(options)
    {
        _mediator = mediator;
    }

    public IDbContextTransaction? GetCurrentTransaction() => _currentTransaction;

    public bool HasActiveTransaction => _currentTransaction != null;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("payroll");
        modelBuilder.ApplyConfiguration(new ClientRequestEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new EmployeeEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PayTermsEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new AttendanceDayEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new LedgerEntryEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PayslipEntityTypeConfiguration());
        modelBuilder.UseIntegrationEventLogs();
    }

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        if (_mediator != null)
        {
            await _mediator.DispatchDomainEventsAsync(this);
        }

        _ = await base.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<IDbContextTransaction?> BeginTransactionAsync()
    {
        if (_currentTransaction != null) return null;

        _currentTransaction = await Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        return _currentTransaction;
    }

    public async Task CommitTransactionAsync(IDbContextTransaction transaction)
    {
        if (transaction == null) throw new ArgumentNullException(nameof(transaction));
        if (transaction != _currentTransaction) throw new InvalidOperationException($"Transaction {transaction.TransactionId} is not current");

        try
        {
            await SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            RollbackTransaction();
            throw;
        }
        finally
        {
            if (HasActiveTransaction)
            {
                _currentTransaction?.Dispose();
                _currentTransaction = null;
            }
        }
    }

    public void RollbackTransaction()
    {
        try
        {
            _currentTransaction?.Rollback();
        }
        finally
        {
            if (HasActiveTransaction)
            {
                _currentTransaction?.Dispose();
                _currentTransaction = null;
            }
        }
    }
}
