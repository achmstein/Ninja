#nullable enable
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Behaviors;

/// <summary>
/// One unit of work, one database transaction, and the integration events it
/// queued published only after the commit. Both ways into Sales go through
/// it: MediatR commands via <see cref="TransactionBehavior{TRequest, TResponse}"/>,
/// and the bus handlers that assemble tickets from other services' events.
/// </summary>
public class SalesTransaction(
    SalesContext dbContext,
    ISalesIntegrationEventService integrationEvents,
    ILogger<SalesTransaction> logger)
{
    public async Task<T> RunAndReturnAsync<T>(string operation, Func<Task<T>> work)
    {
        // Nested: the outer transaction owns the commit and the publish
        if (dbContext.HasActiveTransaction)
            return await work();

        var result = default(T)!;

        // The retrying execution strategy has to own the transaction, so the
        // whole unit of work is what it retries; every unit reloads what it
        // touches, so a retry starts clean
        var strategy = dbContext.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            Guid transactionId;

            await using var transaction = (await dbContext.BeginTransactionAsync())!;

            using (logger.BeginScope(new List<KeyValuePair<string, object>> { new("TransactionContext", transaction.TransactionId) }))
            {
                logger.LogInformation("Begin transaction {TransactionId} for {Operation}", transaction.TransactionId, operation);

                try
                {
                    result = await work();
                    await dbContext.CommitTransactionAsync(transaction);
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    // Somebody else wrote the row first — two tills settling
                    // one ticket, a shift closed twice. The loser is told and
                    // reloads; it never writes over the winner.
                    logger.LogWarning(ex, "Concurrency conflict in {Operation} - transaction {TransactionId} rolled back", operation, transaction.TransactionId);

                    throw new SalesDomainException("Someone else changed this a moment ago. Reload and try again.", ex);
                }

                logger.LogInformation("Committed transaction {TransactionId} for {Operation}", transaction.TransactionId, operation);

                transactionId = transaction.TransactionId;
            }

            await integrationEvents.PublishEventsThroughEventBusAsync(transactionId);
        });

        return result;
    }

    public Task RunAsync(string operation, Func<Task> work)
        => RunAndReturnAsync(operation, async () =>
        {
            await work();
            return true;
        });
}
