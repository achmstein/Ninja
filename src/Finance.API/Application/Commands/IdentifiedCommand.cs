#nullable enable
using Ninja.Finance.Infrastructure.Idempotency;

namespace Ninja.Finance.API.Application.Commands;

/// <summary>
/// A command together with the client's request id. A till on café Wi-Fi
/// retries; the id is what keeps a retried open-tab from becoming two tabs
/// and a retried refund from becoming two credit notes.
/// </summary>
public class IdentifiedCommand<T, R>(T command, Guid id) : IRequest<R>
    where T : IRequest<R>
{
    public T Command { get; } = command;
    public Guid Id { get; } = id;
}

/// <summary>
/// Runs the inner command once per request id. The request row is written
/// in the same transaction as the command (the transaction behavior wraps
/// this handler), so a failure rolls both back and the same id can be
/// retried. A duplicate answers from the current state instead of doing
/// the work again. Same shape as Ordering's.
/// </summary>
public abstract class IdentifiedCommandHandler<T, R>(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<T, R>> logger) : IRequestHandler<IdentifiedCommand<T, R>, R>
    where T : IRequest<R>
{
    /// <summary>
    /// What to answer when the same request id arrives again: the first
    /// attempt already did the work, so this reads its outcome back where
    /// the queries can, and otherwise returns a value the caller treats as
    /// "already done, refetch".
    /// </summary>
    protected abstract Task<R> CreateResultForDuplicateRequestAsync(T command, CancellationToken cancellationToken);

    public async Task<R> Handle(IdentifiedCommand<T, R> message, CancellationToken cancellationToken)
    {
        if (await requestManager.ExistAsync(message.Id))
        {
            logger.LogInformation(
                "Duplicate request {RequestId} for {CommandName} - answering from the current state",
                message.Id, typeof(T).Name);
            return await CreateResultForDuplicateRequestAsync(message.Command, cancellationToken);
        }

        await requestManager.CreateRequestForCommandAsync<T>(message.Id);

        logger.LogInformation("Sending command: {CommandName} for request {RequestId}", typeof(T).Name, message.Id);

        return await mediator.Send(message.Command, cancellationToken);
    }
}
