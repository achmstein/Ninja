#nullable enable
using Chillax.Sales.API.Application.Commands;

namespace Chillax.Sales.API.Apis;

public static class IdempotencyExtensions
{
    /// <summary>
    /// Dispatches a command under the client's <c>x-requestid</c> when one
    /// was sent, so a retry is deduplicated; without one the command runs
    /// as before. The header is optional only so the shipped pos_web keeps
    /// working — every till should send it.
    /// </summary>
    public static Task<R> SendIdentified<T, R>(this IMediator mediator, Guid? requestId, T command)
        where T : IRequest<R>
        => requestId is { } id && id != Guid.Empty
            ? mediator.Send(new IdentifiedCommand<T, R>(command, id))
            : mediator.Send(command);
}
