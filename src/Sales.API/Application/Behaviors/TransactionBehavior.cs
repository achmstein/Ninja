#nullable enable
using Ninja.EventBus.Extensions;

namespace Ninja.Sales.API.Application.Behaviors;

/// <summary>
/// Every command runs inside <see cref="SalesTransaction"/>: one transaction
/// around the handler, the outbox published after the commit.
/// </summary>
public class TransactionBehavior<TRequest, TResponse>(SalesTransaction transaction)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : IRequest<TResponse>
{
    public Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        => transaction.RunAndReturnAsync(request.GetGenericTypeName(), () => next());
}
