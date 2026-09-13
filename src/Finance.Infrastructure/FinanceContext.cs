#nullable enable
using Chillax.IntegrationEventLogEF;

namespace Chillax.Finance.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Finance.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Finance.API --context FinanceContext [migration-name]
/// </remarks>
public class FinanceContext : DbContext, IUnitOfWork
{
    public DbSet<ExpenseCategory> ExpenseCategories { get; set; }
    public DbSet<Expense> Expenses { get; set; }
    public DbSet<RecurringExpense> RecurringExpenses { get; set; }
    public DbSet<ExpenseReceipt> ExpenseReceipts { get; set; }
    public DbSet<PartnerShare> PartnerShares { get; set; }
    public DbSet<Supplier> Suppliers { get; set; }
    public DbSet<SupplierEntry> SupplierEntries { get; set; }
    public DbSet<Partner> Partners { get; set; }
    public DbSet<PartnerEntry> PartnerEntries { get; set; }
    public DbSet<SalesFact> SalesFacts { get; set; }
    public DbSet<CostFact> CostFacts { get; set; }
    public DbSet<LabourFact> LabourFacts { get; set; }

    private readonly IMediator? _mediator;
    private IDbContextTransaction? _currentTransaction;

    public FinanceContext(DbContextOptions<FinanceContext> options, IMediator? mediator = null) : base(options)
    {
        _mediator = mediator;
    }

    public IDbContextTransaction? GetCurrentTransaction() => _currentTransaction;

    public bool HasActiveTransaction => _currentTransaction != null;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("finance");
        modelBuilder.ApplyConfiguration(new ClientRequestEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ExpenseCategoryEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ExpenseEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RecurringExpenseEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ExpenseReceiptEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PartnerShareEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SupplierEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SupplierEntryEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PartnerEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PartnerEntryEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SalesFactEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new CostFactEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new LabourFactEntityTypeConfiguration());
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
