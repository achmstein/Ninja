#nullable enable
using Chillax.IntegrationEventLogEF;
using Chillax.Spaces.Infrastructure.Projections;

namespace Chillax.Spaces.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Spaces.Infrastructure' project directory:
///
/// dotnet ef migrations add --startup-project ../Spaces.API --context SpacesContext [migration-name]
/// </remarks>
public class SpacesContext : DbContext, IUnitOfWork
{
    public DbSet<Place> Places { get; set; }
    public DbSet<Stay> Stays { get; set; }
    public DbSet<StayMember> StayMembers { get; set; }
    public DbSet<StaySegment> StaySegments { get; set; }
    public DbSet<BranchSettings> BranchSettings { get; set; }

    private readonly IMediator? _mediator;
    private IDbContextTransaction? _currentTransaction;

    public SpacesContext(DbContextOptions<SpacesContext> options, IMediator? mediator = null) : base(options)
    {
        _mediator = mediator;
        System.Diagnostics.Debug.WriteLine("SpacesContext::ctor ->" + this.GetHashCode());
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

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        _ = await base.SaveChangesAsync(cancellationToken);

        // Domain events go out after the commit, not before it. Every handler
        // here publishes an integration event straight to the bus, and a
        // screen that hears it refetches at once — dispatched before the
        // commit, that refetch could read the old state and sit on it until
        // its next poll (the "room started but shows no clock" bug). None of
        // the handlers changes entities, so nothing is lost by saving first.
        if (_mediator != null)
        {
            await _mediator.DispatchDomainEventsAsync(this);
        }

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
