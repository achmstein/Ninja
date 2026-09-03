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
    public DbSet<Room> Rooms { get; set; }
    public DbSet<Table> Tables { get; set; }
    public DbSet<Reservation> Reservations { get; set; }
    public DbSet<SessionMember> SessionMembers { get; set; }
    public DbSet<SessionSegment> SessionSegments { get; set; }
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
        modelBuilder.ApplyConfiguration(new RoomEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new TableEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ReservationEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SessionMemberEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SessionSegmentEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new BranchSettingsEntityTypeConfiguration());
        modelBuilder.UseIntegrationEventLogs();
    }

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        // Dispatch Domain Events collection.
        if (_mediator != null)
        {
            await _mediator.DispatchDomainEventsAsync(this);
        }

        // After executing this line all the changes (from the Command Handler and Domain Event Handlers)
        // performed through the DbContext will be committed
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
