#nullable enable
namespace Ninja.Spaces.Infrastructure;

/// <summary>
/// One unit of work per save: a transaction around the rows and the outbox
/// entries the domain event handlers write, committed together, and only
/// then published. A failed commit publishes nothing; a crash between the
/// commit and the publish loses nothing, because the event log still holds
/// the event. The repositories hand this out as their UnitOfWork, so every
/// endpoint and bus handler gets it without knowing.
/// </summary>
public class SpacesUnitOfWork(
    SpacesContext context,
    IMediator mediator,
    IOutboxPublisher? outbox = null,
    ILogger<SpacesUnitOfWork>? logger = null) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => context.SaveChangesAsync(cancellationToken);

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        // Nested: the outer unit owns the commit and the publish
        if (context.HasActiveTransaction)
        {
            await SaveAndDispatchAsync(cancellationToken);
            return true;
        }

        // The retrying execution strategy has to own the transaction, so the
        // whole unit of work is what it retries
        var strategy = context.Database.CreateExecutionStrategy();
        var transactionId = await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = (await context.BeginTransactionAsync())!;
            var id = transaction.TransactionId;
            try
            {
                await SaveAndDispatchAsync(cancellationToken);
                await context.CommitTransactionAsync(transaction);
            }
            catch
            {
                context.RollbackTransaction();
                throw;
            }
            logger?.LogDebug("Committed transaction {TransactionId}", id);
            return id;
        });

        if (outbox is not null)
        {
            await outbox.PublishPendingAsync(transactionId);
        }
        return true;
    }

    /// <summary>
    /// Domain events are gathered before the save and dispatched after it,
    /// inside the transaction. Before: a deleted entity leaves the tracker on
    /// save, and its event would go with it. After: the handlers write the
    /// outbox rows on the same transaction. Ids are HiLo, assigned on Add, so
    /// a handler may read them either way.
    /// </summary>
    private async Task SaveAndDispatchAsync(CancellationToken cancellationToken)
    {
        var entities = context.ChangeTracker
            .Entries<Entity>()
            .Where(e => e.Entity.DomainEvents is { Count: > 0 })
            .Select(e => e.Entity)
            .ToList();
        var domainEvents = entities.SelectMany(e => e.DomainEvents!).ToList();
        entities.ForEach(e => e.ClearDomainEvents());

        await context.SaveChangesAsync(cancellationToken);

        foreach (var domainEvent in domainEvents)
        {
            await mediator.Publish(domainEvent, cancellationToken);
        }
    }

    public void Dispose()
    {
        // The context is scoped and disposed by the container
        GC.SuppressFinalize(this);
    }
}
