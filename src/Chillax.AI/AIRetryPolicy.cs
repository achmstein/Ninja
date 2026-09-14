using System.ClientModel.Primitives;

namespace Chillax.AI;

/// <summary>
/// One retry on a transport error or a 5xx (a free tier says "overloaded"
/// often), never on 429: the SDK's default policy would sleep for the
/// Retry-After the provider sends, tens of seconds, while the user waits and
/// the key's budget drains. A 429 goes straight back as a clear message.
/// </summary>
public sealed class AIRetryPolicy() : ClientRetryPolicy(maxRetries: 1)
{
    protected override bool ShouldRetry(PipelineMessage message, Exception? exception)
        => message.Response?.Status != 429 && base.ShouldRetry(message, exception);

    protected override ValueTask<bool> ShouldRetryAsync(PipelineMessage message, Exception? exception)
        => message.Response?.Status == 429 ? ValueTask.FromResult(false) : base.ShouldRetryAsync(message, exception);
}
