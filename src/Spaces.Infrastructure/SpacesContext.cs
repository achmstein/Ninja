#nullable enable
using Chillax.IntegrationEventLogEF;
using Chillax.Spaces.Infrastructure.Projections;

namespace Chillax.Spaces.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Spaces.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Spaces.API --context SpacesContext [migration-name]
/// </remarks>
public class SpacesContext : DbContext
{
    public DbSet<Place> Places { get; set; }
    public DbSet<Stay> Stays { get; set; }
    public DbSet<StayMember> StayMembers { get; set; }
    public DbSet<StaySegment> StaySegments { get; set; }
    public DbSet<BranchSettings> BranchSettings { get; set; }

    private IDbContextTransaction? _currentTransaction;

    public SpacesContext(DbContextOptions<SpacesContext> options) : base(options)
    {
    }

    public IDbContextTransaction? GetCurrentTransaction() => _currentTransaction;

    public bool HasActiveTransaction => _currentTransaction != null;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("spaces");
        modelBuilder.ApplyConfiguration(new ClientRequestEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new PlaceEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StayEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StayMemberEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new StaySegmentEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new BranchSettingsEntityTypeConfiguration());
        modelBuilder.UseIntegrationEventLogs();
    }

    // Saving, dispatching the domain events and publishing the outbox is
    // SpacesUnitOfWork's; the context only holds the transaction.

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
