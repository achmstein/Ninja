#nullable enable
using Chillax.IntegrationEventLogEF;

namespace Chillax.Inventory.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Inventory.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Inventory.API --context InventoryContext [migration-name]
/// </remarks>
public class InventoryContext : DbContext, IUnitOfWork
{
    public DbSet<StockItem> StockItems { get; set; }
    public DbSet<Recipe> Recipes { get; set; }
    public DbSet<RecipeLine> RecipeLines { get; set; }
    public DbSet<Purchase> Purchases { get; set; }
    public DbSet<PurchaseLine> PurchaseLines { get; set; }
    public DbSet<StockCount> StockCounts { get; set; }
    public DbSet<StockCountLine> StockCountLines { get; set; }
    public DbSet<StockLevel> StockLevels { get; set; }
    public DbSet<StockMovement> StockMovements { get; set; }
    public DbSet<MenuItemStockStatus> MenuItemStockStatuses { get; set; }
    public DbSet<MenuOptionStockStatus> MenuOptionStockStatuses { get; set; }
    public DbSet<Transfer> Transfers { get; set; }
    public DbSet<TransferLine> TransferLines { get; set; }

    private readonly IMediator? _mediator;
    private IDbContextTransaction? _currentTransaction;

    public InventoryContext(DbContextOptions<InventoryContext> options, IMediator? mediator = null) : base(options)
    {
        _mediator = mediator;
    }

    public IDbContextTransaction? GetCurrentTransaction() => _currentTransaction;

    public bool HasActiveTransaction => _currentTransaction != null;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("inventory");
        modelBuilder.ApplyConfiguration(new ClientRequestEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StockItemEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RecipeEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RecipeLineEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RecipeScaleEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PurchaseEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PurchaseLineEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StockCountEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StockCountLineEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StockLevelEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StockMovementEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new MenuItemStockStatusEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new MenuOptionStockStatusEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new TransferEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new TransferLineEntityTypeConfiguration());
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
