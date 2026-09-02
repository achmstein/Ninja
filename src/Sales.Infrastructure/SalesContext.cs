#nullable enable
using Chillax.IntegrationEventLogEF;

namespace Chillax.Sales.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Sales.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Sales.API --context SalesContext [migration-name]
/// </remarks>
public class SalesContext : DbContext, IUnitOfWork
{
    public DbSet<Ticket> Tickets { get; set; }
    public DbSet<TicketLine> TicketLines { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<Receipt> Receipts { get; set; }
    public DbSet<Chillax.Sales.Domain.AggregatesModel.ShiftAggregate.Shift> Shifts { get; set; }
    public DbSet<BranchPricing> BranchPricings { get; set; }
    public DbSet<Refund> Refunds { get; set; }

    private readonly IMediator? _mediator;
    private IDbContextTransaction? _currentTransaction;

    public SalesContext(DbContextOptions<SalesContext> options, IMediator? mediator = null) : base(options)
    {
        _mediator = mediator;
    }

    public IDbContextTransaction? GetCurrentTransaction() => _currentTransaction;

    public bool HasActiveTransaction => _currentTransaction != null;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("sales");
        modelBuilder.ApplyConfiguration(new ClientRequestEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new TicketEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new TicketLineEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ReceiptEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ShiftEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new CashMovementEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new BranchPricingEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RefundEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RefundLineEntityTypeConfiguration());
        modelBuilder.UseIntegrationEventLogs();
    }

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        // Dispatch Domain Events collection.
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
