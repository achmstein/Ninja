#nullable enable
using Ninja.EventBus.Extensions;

namespace Ninja.Inventory.API.Application.Behaviors;

/// <summary>
/// Every command runs inside <see cref="InventoryTransaction"/>: one transaction
/// around the handler, the outbox published after the commit.
/// </summary>
public class TransactionBehavior<TRequest, TResponse>(InventoryTransaction transaction)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : IRequest<TResponse>
{
    public Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        => transaction.RunAndReturnAsync(request.GetGenericTypeName(), () => next());
}
